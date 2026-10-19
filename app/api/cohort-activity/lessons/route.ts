import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { recordCohortActivity } from "@/lib/cohortActivity";
import { z } from "zod";

const Body = z.object({
  courseId: z.string().regex(/^[a-f\d]{24}$/i),
  chapterId: z.string().regex(/^[a-f\d]{24}$/i),
});

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid lesson" }, 400);
  const { courseId, chapterId } = parsed.data;

  await connectDB();
  const [access, chapter] = await Promise.all([
    getCourseAccess(courseId, userId),
    Chapter.findOne({ _id: chapterId, courseId }).select("title").lean(),
  ]);
  if (!access || !chapter) return json({ error: "Lesson not found" }, 404);

  await recordCohortActivity({
    userId,
    type: "lesson-opened",
    courseId,
    chapterId,
    label: `Opened lesson: ${access.course.title} · ${chapter.title}`,
  });
  return json({ ok: true });
}
