import { authorizeChapterEditor } from "@/lib/access";
import { json, parseBody } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { RegenerateBody } from "@/lib/validation";
import { linkSourceImages, writeLecture, writeQuiz } from "@/mastra/generation";
import { recordAdminAction } from "@/lib/adminAudit";
import { stripChapterVideoMarkers } from "@/lib/chapterVideo";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Regenerates ONE chapter's lecture or quiz and returns it WITHOUT saving, so the
 * instructor can review it in the editor (and keep or discard their manual edits).
 * Cost: one chapter chunk in, one lecture (or quiz) out.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeChapterEditor((await params).id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, RegenerateBody);
  if ("res" in body) return body.res;
  const { target, guidance, contentMd } = body.data;
  const { chapter, course } = auth;

  try {
    if (target === "quiz") {
      const questions = await writeQuiz({
        title: chapter.title,
        contentMd: stripChapterVideoMarkers(contentMd || chapter.contentMd),
        guidance,
      });
      if (auth.isAdmin) {
        await recordAdminAction({ actorId: auth.userId, action: "courses.quiz-regenerated", targetType: "chapter", targetId: String(chapter._id) });
      }
      return json({ questions });
    }

    const full = await Chapter.findById(chapter._id).select("+sourceText").lean();
    const titles = (await Chapter.find({ courseId: chapter.courseId }).sort({ index: 1 }).select("title").lean()).map((c) => c.title);
    const text = await writeLecture({
      courseTitle: course.title,
      outline: titles,
      index: chapter.index,
      title: chapter.title,
      // Courses built before source text was kept fall back to rewriting the current lecture.
      sourceText: stripChapterVideoMarkers(full?.sourceText || chapter.contentMd),
      guidance,
    });
    if (auth.isAdmin) {
      await recordAdminAction({ actorId: auth.userId, action: "courses.lecture-regenerated", targetType: "chapter", targetId: String(chapter._id) });
    }
    return json({ contentMd: linkSourceImages(text, full?.sourceText || chapter.contentMd, String(chapter.courseId)) });
  } catch (err) {
    console.error("[regenerate]", err);
    return json({ error: "The model could not generate this. Try again in a moment." }, 502);
  }
}
