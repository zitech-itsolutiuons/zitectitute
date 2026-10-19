import { authorizeChapterEditor } from "@/lib/access";
import { json, parseBody } from "@/lib/http";
import { Quiz } from "@/lib/models/Course";
import { QuizPut } from "@/lib/validation";
import { recordAdminAction } from "@/lib/adminAudit";

/** Replace a chapter's quiz. Saving updates the quiz timestamp, which restarts per-question analytics. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeChapterEditor((await params).id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, QuizPut);
  if ("res" in body) return body.res;
  await Quiz.findOneAndUpdate(
    { chapterId: auth.chapter._id },
    { $set: { questions: body.data.questions, courseId: auth.chapter.courseId } },
    { upsert: true }
  );
  if (auth.isAdmin) {
    await recordAdminAction({ actorId: auth.userId, action: "courses.quiz-edited", targetType: "chapter", targetId: String(auth.chapter._id), details: { questions: body.data.questions.length } });
  }
  return json({ ok: true });
}
