import { connectDB } from "./db";
import { Chapter, Quiz, StudentProgress } from "./models/Course";
import { CourseAccessGrant } from "./models/CourseCommerce";

export type ProgressRow = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  completedChapterIds: string[];
  quizAttempts: { chapterId: string; score: number; total: number; answers: number[]; at: Date }[];
  chatCounts: Record<string, number>;
  assistantMessages: number;
  updatedAt?: Date;
};
export type ChapterInfo = { id: string; index: number; title: string };
export type QuizInfo = { updatedAt: Date; questions: { question: string; correctIndex: number }[] };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Pure function: everything the instructor dashboard shows, computed from stored
 * progress. The owner's own activity is excluded.
 *
 * Per-question results only count each student's latest attempt made AFTER the quiz was last
 * edited and with a matching number of answers, so editing a quiz never mixes old answers
 * into new questions.
 */
export function computeAnalytics(a: {
  ownerId: string;
  chapters: ChapterInfo[];
  quizzes: Record<string, QuizInfo>;
  progress: ProgressRow[];
}) {
  const ids = new Set(a.chapters.map((c) => c.id));
  const students = a.progress.filter((p) => p.userId !== a.ownerId);

  // Each student's best quiz score per chapter (0..1)
  const best = students.map((s) => {
    const out: Record<string, number> = {};
    for (const t of s.quizAttempts) {
      if (!ids.has(t.chapterId) || !t.total) continue;
      out[t.chapterId] = Math.max(out[t.chapterId] ?? 0, t.score / t.total);
    }
    return out;
  });

  const chapters = a.chapters.map((c) => {
    const bests = best.map((b) => b[c.id]).filter((x): x is number => x !== undefined);
    const quiz = a.quizzes[c.id];
    let questions: { question: string; n: number; pctCorrect: number | null }[] = [];
    if (quiz) {
      const tally = quiz.questions.map(() => ({ right: 0, n: 0 }));
      for (const s of students) {
        const latest = s.quizAttempts
          .filter((t) => t.chapterId === c.id && t.at >= quiz.updatedAt && t.answers.length === quiz.questions.length)
          .sort((x, y) => +y.at - +x.at)[0];
        latest?.answers.forEach((ans, i) => {
          tally[i].n++;
          if (ans === quiz.questions[i].correctIndex) tally[i].right++;
        });
      }
      questions = quiz.questions.map((q, i) => ({
        question: q.question,
        n: tally[i].n,
        pctCorrect: tally[i].n ? tally[i].right / tally[i].n : null,
      }));
    }
    return {
      ...c,
      completed: students.filter((s) => s.completedChapterIds.includes(c.id)).length,
      attempted: bests.length,
      avgBest: mean(bests),
      attempts: students.reduce((n, s) => n + s.quizAttempts.filter((t) => t.chapterId === c.id).length, 0),
      asked: students.reduce((n, s) => n + (s.chatCounts[c.id] ?? 0), 0),
      questions,
    };
  });

  const rows = students
    .map((s, i) => ({
      userId: s.userId,
      name: s.displayName || null,
      email: s.email || null,
      completed: s.completedChapterIds.filter((id) => ids.has(id)).length,
      avgScore: mean(Object.values(best[i])),
      assistantMessages: s.assistantMessages ?? 0,
      lastActive: s.updatedAt ?? null,
    }))
    .sort((x, y) => +(y.lastActive ?? 0) - +(x.lastActive ?? 0));

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const total = a.chapters.length;
  return {
    summary: {
      students: rows.length,
      avgCompletion: mean(rows.map((r) => (total ? r.completed / total : 0))),
      avgScore: mean(rows.map((r) => r.avgScore).filter((x): x is number => x !== null)),
      assistantMessages: rows.reduce((n, r) => n + r.assistantMessages, 0),
      activeThisWeek: rows.filter((r) => r.lastActive && +r.lastActive > weekAgo).length,
    },
    chapters,
    students: rows,
  };
}

export async function loadAnalytics(courseId: string, ownerId: string) {
  await connectDB();
  const [chapters, quizzes, grants] = await Promise.all([
    Chapter.find({ courseId }).sort({ index: 1 }).select("index title").lean(),
    Quiz.find({ courseId }).select("chapterId questions.question questions.correctIndex updatedAt").lean(),
    CourseAccessGrant.find({ courseId }).select("userId").lean(),
  ]);
  const paidUserIds = grants.map((grant) => grant.userId);
  const progress = paidUserIds.length
    ? await StudentProgress.find({ courseId, userId: { $in: paidUserIds } }).limit(1000).lean()
    : [];

  return computeAnalytics({
    ownerId,
    chapters: chapters.map((c) => ({ id: String(c._id), index: c.index, title: c.title })),
    quizzes: Object.fromEntries(
      quizzes.map((q) => [
        String(q.chapterId),
        {
          updatedAt: (q as { updatedAt?: Date }).updatedAt ?? new Date(0),
          questions: q.questions.map((x) => ({ question: x.question, correctIndex: x.correctIndex })),
        },
      ])
    ),
    progress: progress.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      email: p.email,
      completedChapterIds: (p.completedChapterIds ?? []).map(String),
      quizAttempts: (p.quizAttempts ?? []).map((t) => ({
        chapterId: String(t.chapterId),
        score: t.score ?? 0,
        total: t.total ?? 0,
        answers: t.answers ?? [],
        at: t.at ?? new Date(0),
      })),
      chatCounts: { ...((p.chatCounts as unknown as Record<string, number>) ?? {}) },
      assistantMessages: p.assistantMessages ?? 0,
      updatedAt: (p as { updatedAt?: Date }).updatedAt,
    })),
  });
}
