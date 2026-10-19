"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import { Course } from "@/lib/models/Course";
import { User } from "@/lib/models/User";

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

function refreshCohorts() {
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/users/import");
  revalidatePath("/cohorts");
}

export async function createCohortAction(formData: FormData) {
  const actorId = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const courseIds = [...new Set(formData.getAll("courseIds").filter((value): value is string => typeof value === "string"))];
  if (!name || name.length > 100 || description.length > 500 || courseIds.some((id) => !isValidObjectId(id))) {
    redirect("/admin/cohorts?notice=invalid");
  }

  await connectDB();
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds }, archivedAt: null }).select("_id").lean()
    : [];
  if (courses.length !== courseIds.length) redirect("/admin/cohorts?notice=course");
  const cohort = await Cohort.create({ name, description, courseIds, createdBy: actorId });
  await recordAdminAction({
    actorId,
    action: "cohort.created",
    targetType: "cohort",
    targetId: String(cohort._id),
    details: { name, courses: courseIds.length },
  });
  refreshCohorts();
  redirect("/admin/cohorts?notice=created");
}

export async function updateCohortAction(formData: FormData) {
  const actorId = await requireAdmin();
  const cohortId = String(formData.get("cohortId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const courseIds = [...new Set(formData.getAll("courseIds").filter((value): value is string => typeof value === "string"))];
  const returnTo = `/admin/cohorts/${encodeURIComponent(cohortId)}`;
  if (!isValidObjectId(cohortId) || !name || name.length > 100 || description.length > 500 || courseIds.some((id) => !isValidObjectId(id))) {
    redirect(`${returnTo}?notice=invalid`);
  }

  await connectDB();
  const existing = await Cohort.findById(cohortId).select("name courseIds").lean();
  if (!existing) redirect("/admin/cohorts?notice=missing");
  const courses = courseIds.length
    ? await Course.find({
        _id: { $in: courseIds },
        $or: [{ archivedAt: null }, { _id: { $in: existing.courseIds } }],
      }).select("_id").lean()
    : [];
  if (courses.length !== courseIds.length) redirect(`${returnTo}?notice=course`);
  await Cohort.updateOne({ _id: cohortId }, { $set: { name, description, courseIds } });
  await recordAdminAction({
    actorId,
    action: "cohort.updated",
    targetType: "cohort",
    targetId: cohortId,
    details: { nameChanged: existing.name !== name, coursesChanged: existing.courseIds.map(String).sort().join(",") !== [...courseIds].sort().join(",") },
  });
  refreshCohorts();
  redirect(`${returnTo}?notice=updated`);
}

export async function addCohortMemberAction(formData: FormData) {
  const actorId = await requireAdmin();
  const cohortId = String(formData.get("cohortId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const returnTo = `/admin/cohorts/${encodeURIComponent(cohortId)}`;
  if (!isValidObjectId(cohortId) || !isValidObjectId(userId)) redirect("/admin/cohorts?notice=invalid");

  await connectDB();
  const [cohort, user] = await Promise.all([
    Cohort.exists({ _id: cohortId }),
    User.exists({ _id: userId, role: "user" }),
  ]);
  if (!cohort) redirect("/admin/cohorts?notice=missing");
  if (!user) redirect(`${returnTo}?notice=invalid`);
  await Cohort.updateOne({ _id: cohortId }, { $addToSet: { memberUserIds: userId } });
  await recordAdminAction({ actorId, action: "cohort.member-added", targetType: "cohort", targetId: cohortId, details: { userId } });
  refreshCohorts();
  redirect(`${returnTo}?notice=member-added`);
}

export async function removeCohortMemberAction(formData: FormData) {
  const actorId = await requireAdmin();
  const cohortId = String(formData.get("cohortId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const returnTo = `/admin/cohorts/${encodeURIComponent(cohortId)}`;
  if (!isValidObjectId(cohortId) || !isValidObjectId(userId)) redirect("/admin/cohorts?notice=invalid");

  await connectDB();
  const result = await Cohort.updateOne({ _id: cohortId }, { $pull: { memberUserIds: userId } });
  if (!result.matchedCount) redirect("/admin/cohorts?notice=missing");
  await recordAdminAction({ actorId, action: "cohort.member-removed", targetType: "cohort", targetId: cohortId, details: { userId } });
  refreshCohorts();
  redirect(`${returnTo}?notice=member-removed`);
}

export async function deleteCohortAction(formData: FormData) {
  const actorId = await requireAdmin();
  const cohortId = String(formData.get("cohortId") ?? "");
  if (!isValidObjectId(cohortId)) redirect("/admin/cohorts?notice=missing");
  await connectDB();
  const result = await Cohort.deleteOne({ _id: cohortId });
  if (!result.deletedCount) redirect("/admin/cohorts?notice=missing");
  await recordAdminAction({ actorId, action: "cohort.deleted", targetType: "cohort", targetId: cohortId });
  refreshCohorts();
  redirect("/admin/cohorts?notice=deleted");
}
