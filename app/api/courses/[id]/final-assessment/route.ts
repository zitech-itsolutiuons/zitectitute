import { authorizeCourseEditor } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Chapter, CourseFinalAssessment } from "@/lib/models/Course";
import { writeFinalAssessment } from "@/mastra/generation";
import { recordAdminAction } from "@/lib/adminAudit";
import { stripChapterVideoMarkers } from "@/lib/chapterVideo";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const auth = await authorizeCourseEditor((await params).id);
  if (auth instanceof Response) return auth;

  await connectDB();
  const chapters = await Chapter.find({ courseId: auth.course._id }).sort({ index: 1 }).select("title contentMd").lean();
  if (!chapters.length) return json({ error: "Add course modules before generating the final assessment." }, 409);

  try {
    const assessment = await writeFinalAssessment({
      courseTitle: auth.course.title,
      chapters: chapters.map((chapter) => ({ title: chapter.title, contentMd: stripChapterVideoMarkers(chapter.contentMd) })),
    });
    const saved = await CourseFinalAssessment.findOneAndUpdate(
      { courseId: auth.course._id },
      { $set: { courseId: auth.course._id, ...assessment } },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    if (auth.isAdmin) {
      await recordAdminAction({ actorId: auth.userId, action: "courses.final-assessment-generated", targetType: "course", targetId: String(auth.course._id) });
    }
    return json({
      objectiveQuestions: saved?.objectiveQuestions ?? assessment.objectiveQuestions,
      theoryQuestions: saved?.theoryQuestions ?? assessment.theoryQuestions,
    });
  } catch (error) {
    console.error("[final-assessment] regeneration failed", error);
    return json({ error: "The final assessment could not be generated. Try again." }, 502);
  }
}