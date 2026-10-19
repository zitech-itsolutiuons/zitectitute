import { randomBytes } from "node:crypto";
import { connectDB } from "./db";
import {
  Chapter,
  Course,
  CourseFinalAssessment,
  CourseGroup,
  CourseGroupSettings,
  CourseMedia,
  CourseRestriction,
  Quiz,
  StudentNote,
  StudentProgress,
} from "./models/Course";
import { CourseAccessGrant, CoursePayment, PromoCode } from "./models/CourseCommerce";

/**
 * Database operations behind the editor and sharing routes. Kept out of the route
 * handlers so they stay thin and can be tested directly.
 */

/**
 * Renumber chapters to match `orderedIds`. Chapter (courseId, index) is unique, so this
 * moves everything out of the way first, then assigns final positions. If it is interrupted,
 * chapters still sort correctly (just with large indexes) and the next reorder repairs it.
 */
export async function setChapterOrder(courseId: string, orderedIds: string[]) {
  await connectDB();
  await Chapter.updateMany({ courseId }, { $inc: { index: 1_000_000 } });
  for (const [i, id] of orderedIds.entries()) await Chapter.updateOne({ _id: id, courseId }, { $set: { index: i } });
}

export async function addChapter(courseId: string, title = "New module") {
  await connectDB();
  const index = await Chapter.countDocuments({ courseId });
  const chapter = await Chapter.create({ courseId, index, title, contentMd: "Write the module content here." });
  await Quiz.create({ courseId, chapterId: chapter._id, questions: [] });
  await Course.updateOne({ _id: courseId }, { $set: { chapterCount: index + 1 } });
  return chapter;
}

/** Returns false (and deletes nothing) when this is the course's only chapter. */
export async function deleteChapter(courseId: string, chapterId: string) {
  await connectDB();
  if ((await Chapter.countDocuments({ courseId })) <= 1) return false;
  await Chapter.deleteOne({ _id: chapterId, courseId });
  await Quiz.deleteOne({ chapterId });
  const rest = await Chapter.find({ courseId }).sort({ index: 1 }).select("_id").lean();
  await setChapterOrder(courseId, rest.map((c) => String(c._id)));
  await Course.updateOne({ _id: courseId }, { $set: { chapterCount: rest.length } });
  await StudentProgress.updateMany({ courseId }, { $pull: { completedChapterIds: chapterId } });
  return true;
}

export async function deleteCourse(courseId: string) {
  await connectDB();
  const groupsContainingCourse = await CourseGroup.find({ courseIds: courseId }).select("_id").lean();
  await Promise.all([
    Chapter.deleteMany({ courseId }),
    CourseMedia.deleteMany({ courseId }),
    Quiz.deleteMany({ courseId }),
    CourseFinalAssessment.deleteMany({ courseId }),
    StudentNote.deleteMany({ courseId }),
    StudentProgress.deleteMany({ courseId }),
    CourseAccessGrant.deleteMany({ courseId }),
    PromoCode.deleteMany({ courseId }),
    CourseRestriction.deleteMany({ courseId }),
    CourseGroup.updateMany({ courseIds: courseId }, { $pull: { courseIds: courseId } }),
  ]);
  await CourseGroup.deleteMany({
    _id: { $in: groupsContainingCourse.map((group) => group._id) },
    courseIds: { $size: 0 },
  });
  await Course.deleteOne({ _id: courseId });
}

/* ------------------------------ sharing ------------------------------ */

const newCode = () => randomBytes(12).toString("base64url"); // 96 bits: unguessable

export async function setSharing(courseId: string, opts: { enabled?: boolean; reset?: boolean }) {
  await connectDB();
  const course = await Course.findById(courseId).select("shareCode sharingEnabled").lean();
  if (!course) return null;
  const shareCode = opts.reset || !course.shareCode ? newCode() : course.shareCode;
  const sharingEnabled = opts.enabled ?? course.sharingEnabled ?? false;
  await Course.updateOne({ _id: courseId }, { $set: { shareCode, sharingEnabled } });
  return { shareCode, sharingEnabled };
}

/** Enrols the user in the course behind a share link. Returns null when the link is invalid or switched off. */
export async function joinByCode(code: string, user: { id: string; name?: string | null; email?: string | null }) {
  await connectDB();
  const course = await Course.findOne({ shareCode: code, sharingEnabled: true, status: "ready", archivedAt: null }).lean();
  if (course) {
    if (await CourseRestriction.exists({ userId: user.id, courseId: course._id })) return null;
    if (course.ownerId === user.id) return course;
    await StudentProgress.findOneAndUpdate(
      { userId: user.id, courseId: course._id },
      { $set: { displayName: user.name ?? null, email: user.email ?? null }, $setOnInsert: { enrolledAt: new Date() } },
      { upsert: true }
    );
    return course;
  }

  const settings = await CourseGroupSettings.findOne({ key: "course-groups" }).select("enabled").lean();
  if (!settings?.enabled) return null;
  const group = await CourseGroup.findOne({ code, enabled: true }).lean();
  if (!group) return null;

  const courses = await Course.find({ _id: { $in: group.courseIds }, status: "ready", archivedAt: null }).select("_id ownerId").lean();
  const restrictions = await CourseRestriction.find({ userId: user.id, courseId: { $in: courses.map((item) => item._id) } })
    .select("courseId")
    .lean();
  const restrictedIds = new Set(restrictions.map((item) => String(item.courseId)));
  const joinable = courses.filter((item) => item.ownerId !== user.id && !restrictedIds.has(String(item._id)));
  if (joinable.length === 0) return null;

  await StudentProgress.bulkWrite(
    joinable.map((item) => ({
      updateOne: {
        filter: { userId: user.id, courseId: item._id },
        update: {
          $set: { displayName: user.name ?? null, email: user.email ?? null },
          $setOnInsert: { enrolledAt: new Date() },
        },
        upsert: true,
      },
    }))
  );
  return joinable[0];
}

export async function removeStudent(courseId: string, userId: string) {
  await connectDB();
  const revokedPayments = await CoursePayment.updateMany(
    { courseId, userId, status: { $in: ["pending", "success"] }, accessRevokedAt: null },
    { $set: { accessRevokedAt: new Date() } }
  );
  const [progress, grant] = await Promise.all([
    StudentProgress.deleteOne({ courseId, userId }),
    CourseAccessGrant.deleteOne({ courseId, userId }),
  ]);
  return progress.deletedCount > 0 || grant.deletedCount > 0 || revokedPayments.modifiedCount > 0;
}
