"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction } from "@/lib/models/Course";
import { User } from "@/lib/models/User";
import { hashPassword } from "@/lib/password";

export async function updateUserRole(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!Types.ObjectId.isValid(targetId) || !["admin", "instructor", "user"].includes(role)) redirect("/admin/users");

  await connectDB();
  const target = await User.findById(targetId).select("role").lean();
  if (!target) redirect("/admin/users?notice=missing");
  if (actorId === targetId && role !== "admin") redirect("/admin/users?notice=self");
  if (target.role === "admin" && role !== "admin" && (await User.countDocuments({ role: "admin" })) <= 1)
    redirect("/admin/users?notice=lastAdmin");

  await User.updateOne(
    { _id: targetId },
    {
      $set: { role },
      ...(role !== "user" ? { $unset: { platformRestrictedAt: 1, platformRestrictedBy: 1 } } : {}),
    }
  );
  if (role !== "instructor") await Course.updateMany({ instructorId: targetId }, { $unset: { instructorId: 1 } });
  await recordAdminAction({
    actorId,
    action: "users.role-changed",
    targetType: "user",
    targetId,
    details: { role },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  redirect("/admin/users?notice=updated");
}

export async function updatePlatformAccess(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  if (!Types.ObjectId.isValid(targetId) || !["restrict", "restore"].includes(mode))
    redirect("/admin/users");

  await connectDB();
  const target = await User.findById(targetId).select("role").lean();
  if (!target) redirect("/admin/users?notice=missing");
  if (target.role !== "user") redirect("/admin/users?notice=notLearner");

  let updated = false;
  if (mode === "restrict") {
    const result = await User.updateOne(
      { _id: targetId, role: "user" },
      { $set: { platformRestrictedAt: new Date(), platformRestrictedBy: actorId } }
    );
    updated = result.matchedCount > 0;
  } else {
    const result = await User.updateOne(
      { _id: targetId, role: "user" },
      { $unset: { platformRestrictedAt: 1, platformRestrictedBy: 1 } }
    );
    updated = result.matchedCount > 0;
  }
  if (!updated) redirect("/admin/users?notice=notLearner");

  await recordAdminAction({
    actorId,
    action: mode === "restrict" ? "users.platform-restricted" : "users.platform-restored",
    targetType: "user",
    targetId,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/courses");
  redirect(`/admin/users?notice=platform${mode === "restrict" ? "Restricted" : "Restored"}`);
}

export async function updateCourseAccess(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const targetPath = `/admin/users/${encodeURIComponent(targetId)}`;
  if (!Types.ObjectId.isValid(targetId) || !Types.ObjectId.isValid(courseId) || !["restrict", "restore"].includes(mode))
    redirect("/admin/users");

  await connectDB();
  const [target, course] = await Promise.all([User.exists({ _id: targetId }), Course.exists({ _id: courseId })]);
  if (!target || !course) redirect(`${targetPath}?notice=missing`);

  if (mode === "restrict") {
    await CourseRestriction.updateOne(
      { userId: targetId, courseId },
      { $setOnInsert: { restrictedBy: actorId } },
      { upsert: true }
    );
  } else {
    await CourseRestriction.deleteOne({ userId: targetId, courseId });
  }

  await recordAdminAction({
    actorId,
    action: `users.course-access-${mode}`,
    targetType: "course-access",
    targetId: `${targetId}:${courseId}`,
    details: { userId: targetId, courseId },
  });
  revalidatePath("/courses");
  revalidatePath(targetPath);
  redirect(`${targetPath}?notice=${mode === "restrict" ? "restricted" : "restored"}`);
}

export async function resetUserPasswordAction(formData: FormData) {
  const actorId = await getUserId();
  if (!actorId) redirect("/signin");
  if (!(await isAdmin(actorId))) redirect("/courses");

  const targetId = String(formData.get("userId") ?? "");
  const targetPath = `/admin/users/${encodeURIComponent(targetId)}`;
  if (!Types.ObjectId.isValid(targetId)) redirect("/admin/users?notice=missing");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 12 || password.length > 128) redirect(`${targetPath}?notice=passwordInvalid`);
  if (password !== confirmPassword) redirect(`${targetPath}?notice=passwordMismatch`);

  await connectDB();
  const passwordHash = await hashPassword(password);
  const result = await User.updateOne(
    { _id: targetId },
    {
      $set: { passwordHash, failedLogins: 0 },
      $unset: { lockedUntil: 1 },
      $inc: { sessionVersion: 1 },
    }
  );
  if (!result.matchedCount) redirect("/admin/users?notice=missing");

  await recordAdminAction({ actorId, action: "users.password-reset", targetType: "user", targetId });
  revalidatePath(targetPath);
  revalidatePath("/admin/users");
  redirect(`${targetPath}?notice=passwordUpdated`);
}