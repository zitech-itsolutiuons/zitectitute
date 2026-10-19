import { after } from "next/server";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { deleteCourse } from "@/lib/courseOps";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { createChapterVideoMarker } from "@/lib/chapterVideo";
import { notifyLearnersAboutCourse } from "@/lib/courseNotifications";
import { Chapter, Course, Quiz } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { VideoCourseInput } from "@/lib/validation";
import { parseCourseCover, saveCourseCover } from "@/lib/courseCover";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required." }, 401);
  if (!(await isAdmin(userId))) return json({ error: "Only administrators can create video courses." }, 403);

  const form = await request.formData();
  let lessons: unknown = null;
  const lessonsInput = form.get("lessons");
  if (typeof lessonsInput === "string") {
    try {
      lessons = JSON.parse(lessonsInput);
    } catch {
      return json({ error: "Course lessons must be valid JSON." }, 400);
    }
  }
  const parsed = VideoCourseInput.safeParse({
    title: form.get("title"),
    description: form.get("description") ?? "",
    categoryId: form.get("categoryId"),
    lessons,
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  const parsedCover = await parseCourseCover(form.get("coverImage"));
  if (!parsedCover.ok) return json({ error: parsedCover.error }, 400);

  await connectDB();
  const category = await CourseCategory.findById(parsed.data.categoryId).select("_id").lean();
  if (!category) return json({ error: "That course category no longer exists. Choose another category." }, 400);

  let courseId: string | null = null;
  try {
    const course = await Course.create({
      ownerId: userId,
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: category._id,
      format: "video",
      status: "ready",
      stage: "ready",
      chapterCount: parsed.data.lessons.length,
      totalChapters: parsed.data.lessons.length,
      lecturesDone: parsed.data.lessons.length,
      catalogVisible: true,
    });
    courseId = String(course._id);
    await saveCourseCover(courseId, parsedCover.cover);

    const chapters = await Chapter.insertMany(parsed.data.lessons.map((lesson, index) => ({
      courseId: course._id,
      index,
      title: lesson.title,
      contentMd: createChapterVideoMarker(lesson.videoUrl),
      videoUrl: "",
    })));
    await Quiz.insertMany(chapters.map((chapter) => ({
      courseId: course._id,
      chapterId: chapter._id,
      questions: [],
    })));

    await recordAdminAction({
      actorId: userId,
      action: "courses.video-created",
      targetType: "course",
      targetId: courseId,
      details: { lessonCount: chapters.length },
    });
  } catch (error) {
    if (courseId) {
      await deleteCourse(courseId);
    }
    throw error;
  }
  if (!courseId) throw new Error("Video course setup completed without a course ID.");
  const createdCourseId = courseId;

  after(async () => {
    try {
      await notifyLearnersAboutCourse(createdCourseId, parsed.data.title);
    } catch (error) {
      console.error("[course-notifications]", createdCourseId, error);
    }
  });

  return json({ courseId: createdCourseId }, 201);
}
