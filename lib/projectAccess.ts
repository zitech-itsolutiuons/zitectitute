import { isValidObjectId } from "mongoose";
import { getCourseAccess } from "@/lib/access";
import { isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";

export async function getCourseProjectContext(courseId: string, userId: string) {
  if (!isValidObjectId(courseId)) return null;
  const access = await getCourseAccess(courseId, userId);
  if (access && (access.role === "owner" || access.role === "instructor")) {
    return { course: access.course, role: access.role };
  }
  if (await isAdmin(userId)) {
    if (access) return { course: access.course, role: "admin" as const };
    await connectDB();
    const course = await Course.findOne({ _id: courseId, archivedAt: null }).lean();
    return course ? { course, role: "admin" as const } : null;
  }
  if (access?.role === "student") return { course: access.course, role: "student" as const };
  return null;
}
