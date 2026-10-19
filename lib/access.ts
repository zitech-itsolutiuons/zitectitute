import { isValidObjectId } from "mongoose";
import { getUserId, isAdmin } from "./auth";
import { connectDB } from "./db";
import { json } from "./http";
import { Cohort } from "./models/Cohort";
import { Chapter, Course, CourseRestriction, StudentProgress } from "./models/Course";
import { CourseAccessGrant } from "./models/CourseCommerce";
import { User } from "./models/User";

/** Course owners, assigned instructors, and users with a verified course grant may study. */
export async function getCourseAccess(
  courseId: string,
  userId: string,
  options: { allowCatalogPreview?: boolean } = {}
) {
  if (!isValidObjectId(courseId)) return null;
  await connectDB();
  const course = await Course.findById(courseId).lean();
  if (!course || course.archivedAt) return null;
  if (await CourseRestriction.exists({ userId, courseId: course._id })) return null;
  if (course.ownerId === userId) return { course, role: "owner" as const };
  if (course.instructorId === userId && await User.exists({ _id: userId, role: "instructor" }))
    return { course, role: "instructor" as const };
  if (await Cohort.exists({ memberUserIds: userId, courseIds: course._id }))
    return { course, role: "student" as const };
  if (await CourseAccessGrant.exists({ userId, courseId: course._id })) return { course, role: "student" as const };
  const joined = await StudentProgress.exists({ userId, courseId });
  const hasPurchasePrice = Number.isSafeInteger(course.priceKobo) && typeof course.priceKobo === "number" && course.priceKobo >= 100;
  if (
    options.allowCatalogPreview &&
    course.status === "ready" &&
    (course.catalogVisible || joined || hasPurchasePrice)
  ) {
    return { course, role: "purchase" as const };
  }
  if (options.allowCatalogPreview && course.catalogVisible) return { course, role: "catalog" as const };
  return null;
}

/** For API routes that only the instructor may call. Returns the context, or a Response to send back. */
export async function authorizeOwner(courseId: string) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const access = await getCourseAccess(courseId, userId);
  if (!access) return json({ error: "Not found" }, 404);
  if (access.role !== "owner") return json({ error: "Only the course owner can do this" }, 403);
  return { userId, course: access.course };
}

/** Course owners, assigned instructors, and administrators may edit content; only owners retain owner-only actions. */
export async function authorizeCourseEditor(courseId: string) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const access = await getCourseAccess(courseId, userId);
  if (access?.role === "owner" || access?.role === "instructor")
    return { userId, course: access.course, isAdmin: await isAdmin(userId) };
  if (!(await isAdmin(userId))) return json({ error: "Not found" }, 404);
  if (!isValidObjectId(courseId)) return json({ error: "Not found" }, 404);
  await connectDB();
  const course = await Course.findOne({ _id: courseId, archivedAt: null }).lean();
  if (!course) return json({ error: "Not found" }, 404);
  return { userId, course, isAdmin: true };
}

export async function authorizeChapterEditor(chapterId: string) {
  if (!isValidObjectId(chapterId)) return json({ error: "Not found" }, 404);
  await connectDB();
  const chapter = await Chapter.findById(chapterId).select("courseId title index contentMd").lean();
  if (!chapter) return json({ error: "Not found" }, 404);
  const auth = await authorizeCourseEditor(String(chapter.courseId));
  if (auth instanceof Response) return auth;
  return { ...auth, chapter };
}

export async function authorizeChapterOwner(chapterId: string) {
  if (!isValidObjectId(chapterId)) return json({ error: "Not found" }, 404);
  await connectDB();
  const chapter = await Chapter.findById(chapterId).select("courseId title index contentMd").lean();
  if (!chapter) return json({ error: "Not found" }, 404);
  const auth = await authorizeOwner(String(chapter.courseId));
  if (auth instanceof Response) return auth;
  return { ...auth, chapter };
}
