"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { deleteCourse } from "@/lib/courseOps";
import { Course } from "@/lib/models/Course";
import { User } from "@/lib/models/User";

export type CourseActionState = { error?: string; success?: string };

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

function readCourseId(formData: FormData) {
  const courseId = formData.get("courseId");
  return typeof courseId === "string" && isValidObjectId(courseId) ? courseId : null;
}

function refreshCourseSurfaces() {
  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  revalidatePath("/admin/groups");
  revalidatePath("/admin/users");
  revalidatePath("/courses");
  revalidatePath("/");
  revalidatePath("/join/[code]", "page");
}

export async function archiveCourseAction(_previous: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const actorId = await requireAdmin();
  const courseId = readCourseId(formData);
  if (!courseId) return { error: "This course could not be identified." };

  await connectDB();
  const result = await Course.updateOne(
    { _id: courseId, archivedAt: null },
    { $set: { archivedAt: new Date() } }
  );
  if (!result.matchedCount) return { error: "This course is already archived or no longer exists." };

  await recordAdminAction({ actorId, action: "courses.archived", targetType: "course", targetId: courseId });
  refreshCourseSurfaces();
  return { success: "Course moved to the archive. Students can no longer access it." };
}

export async function restoreCourseAction(_previous: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const actorId = await requireAdmin();
  const courseId = readCourseId(formData);
  if (!courseId) return { error: "This course could not be identified." };

  await connectDB();
  const result = await Course.updateOne(
    { _id: courseId, archivedAt: { $ne: null } },
    { $unset: { archivedAt: 1 } }
  );
  if (!result.matchedCount) return { error: "This course is already active or no longer exists." };

  await recordAdminAction({ actorId, action: "courses.restored", targetType: "course", targetId: courseId });
  refreshCourseSurfaces();
  return { success: "Course restored to active courses." };
}

export async function permanentlyDeleteCourseAction(_previous: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const actorId = await requireAdmin();
  const courseId = readCourseId(formData);
  if (!courseId) return { error: "This course could not be identified." };

  await connectDB();
  const course = await Course.findById(courseId).select("status").lean();
  if (!course) return { error: "This course no longer exists." };
  if (course.status === "processing") {
    return { error: "This course is still being generated. Wait for generation to finish before deleting it." };
  }

  await deleteCourse(courseId);
  await recordAdminAction({ actorId, action: "courses.permanently-deleted", targetType: "course", targetId: courseId });
  refreshCourseSurfaces();
  return { success: "Course and its associated student data were permanently deleted." };
}

export async function assignCourseInstructorAction(formData: FormData) {
  const actorId = await requireAdmin();
  const courseId = formData.get("courseId");
  const instructorId = formData.get("instructorId");
  if (typeof courseId !== "string" || !isValidObjectId(courseId)) {
    redirect("/admin/courses?instructor=invalid");
  }
  if (typeof instructorId !== "string" || (instructorId && !isValidObjectId(instructorId))) {
    redirect("/admin/courses?instructor=invalid");
  }

  await connectDB();
  if (!(await Course.exists({ _id: courseId }))) redirect("/admin/courses?instructor=missing");
  if (instructorId && !(await User.exists({ _id: instructorId, role: "instructor" }))) {
    redirect("/admin/courses?instructor=invalid");
  }

  const update = instructorId ? { $set: { instructorId } } : { $unset: { instructorId: 1 } };
  await Course.updateOne({ _id: courseId }, update);
  await recordAdminAction({
    actorId,
    action: "courses.instructor-assigned",
    targetType: "course",
    targetId: courseId,
    details: { instructorId: instructorId || null },
  });
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  redirect("/admin/courses?instructor=saved");
}
