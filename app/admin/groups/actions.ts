"use server";

import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { Course, CourseGroup, CourseGroupSettings } from "@/lib/models/Course";
import { NewCourseGroup } from "@/lib/validation";

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

export async function setCourseGroupCodesEnabled(formData: FormData) {
  const userId = await requireAdmin();
  const enabled = formData.get("enabled") === "true";
  await connectDB();
  await CourseGroupSettings.findOneAndUpdate(
    { key: "course-groups" },
    { $set: { enabled, updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await recordAdminAction({
    actorId: userId,
    action: "course-groups.feature-toggled",
    targetType: "course-groups",
    details: { enabled },
  });
  revalidatePath("/admin/groups");
  revalidatePath("/courses");
  redirect(`/admin/groups?notice=${enabled ? "enabled" : "disabled"}`);
}

export async function createCourseGroup(formData: FormData) {
  const userId = await requireAdmin();
  const parsed = NewCourseGroup.safeParse({
    name: formData.get("name"),
    courseIds: [...new Set(formData.getAll("courseIds").filter((value): value is string => typeof value === "string"))],
  });
  if (!parsed.success) redirect("/admin/groups?notice=invalid");

  await connectDB();
  const courses = await Course.find({ _id: { $in: parsed.data.courseIds }, status: "ready", archivedAt: null }).select("_id").lean();
  if (courses.length !== parsed.data.courseIds.length) redirect("/admin/groups?notice=unavailable");

  let code: string;
  do {
    code = randomBytes(12).toString("base64url");
  } while (await CourseGroup.exists({ code }) || await Course.exists({ shareCode: code }));

  const group = await CourseGroup.create({
    name: parsed.data.name,
    code,
    courseIds: parsed.data.courseIds,
    createdBy: userId,
    enabled: true,
  });
  await recordAdminAction({
    actorId: userId,
    action: "course-groups.created",
    targetType: "course-group",
    targetId: String(group._id),
    details: { name: parsed.data.name, courses: parsed.data.courseIds.length },
  });
  revalidatePath("/admin/groups");
  redirect("/admin/groups?notice=created");
}

export async function setCourseGroupEnabled(formData: FormData) {
  const userId = await requireAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!Types.ObjectId.isValid(groupId)) redirect("/admin/groups?notice=missing");

  await connectDB();
  const result = await CourseGroup.updateOne({ _id: groupId }, { $set: { enabled } });
  if (result.matchedCount === 0) redirect("/admin/groups?notice=missing");
  await CourseGroupSettings.updateOne({ key: "course-groups" }, { $set: { updatedBy: userId } });
  await recordAdminAction({
    actorId: userId,
    action: "course-groups.toggled",
    targetType: "course-group",
    targetId: groupId,
    details: { enabled },
  });
  revalidatePath("/admin/groups");
  redirect(`/admin/groups?notice=${enabled ? "groupEnabled" : "groupDisabled"}`);
}