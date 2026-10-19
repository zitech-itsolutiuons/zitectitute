import { getUserId } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCourseAccess } from "@/lib/access";
import { Chapter, Quiz, StudentProgress } from "@/lib/models/Course";
import { QUIZ_PASS_THRESHOLD } from "@/lib/quizProgress";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { recordCohortActivity } from "@/lib/cohortActivity";

const oid = z.string().regex(/^[a-f\d]{24}$/i);
const Body = z.object({
  courseId: oid,
  chapterId: oid,
  answers: z.array(z.number().int()).max(15),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { courseId, chapterId, answers } = parsed.data;

  await connectDB();
  const access = await getCourseAccess(courseId, userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [chapter, quiz, settings] = await Promise.all([
    Chapter.findOne({ _id: chapterId, courseId }).select("title").lean(),
    Quiz.findOne({ chapterId, courseId }).select("questions").lean(),
    PlatformSettings.findOne({ key: "platform" }).select("studentQuizQuestionLimit").lean(),
  ]);
  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!quiz || quiz.questions.length === 0) return NextResponse.json({ error: "This module has no quiz to record" }, { status: 400 });
  const questionLimit = access.role === "owner"
    ? 15
    : Math.min(15, Math.max(1, settings?.studentQuizQuestionLimit ?? 15));
  const questions = quiz.questions.slice(0, questionLimit);
  if (
    answers.length !== questions.length ||
    answers.some((answer, index) => answer < 0 || answer >= questions[index].options.length)
  ) {
    return NextResponse.json({ error: "Answer every quiz question before submitting" }, { status: 400 });
  }
  const total = questions.length;
  const score = answers.reduce(
    (sum, answer, index) => sum + (answer === questions[index].correctIndex ? 1 : 0),
    0
  );
  await StudentProgress.findOneAndUpdate(
    { userId, courseId },
    {
      $set: { lastChapterId: chapterId },
      $push: { quizAttempts: { chapterId, score, total, answers, questionIndexes: questions.map((_, index) => index), at: new Date() } },
      ...(score / total >= QUIZ_PASS_THRESHOLD ? { $addToSet: { completedChapterIds: chapterId } } : {}),
    },
    { upsert: true }
  );
  await recordCohortActivity({
    userId,
    type: "quiz-submitted",
    courseId,
    chapterId,
    label: `Submitted quiz: ${access.course.title} · ${chapter.title}`,
  });
  return NextResponse.json({ ok: true });
}
