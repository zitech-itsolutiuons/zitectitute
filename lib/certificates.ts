import { randomUUID } from "node:crypto";
import { parseChapterSections } from "@/lib/chapterSections";
import { connectDB } from "@/lib/db";
import { Chapter, Course, CourseFinalAssessment, Quiz, StudentProgress } from "@/lib/models/Course";
import { Certificate, Notification } from "@/lib/models/LearningFeatures";
import { User } from "@/lib/models/User";
import { QUIZ_PASS_THRESHOLD } from "@/lib/quizProgress";

export function passedQuizForChapter(
  attempts: { chapterId: unknown; answers: number[]; questionIndexes?: number[]; at: Date }[],
  chapterId: string,
  correctIndexes: number[],
  updatedAt?: Date
) {
  if (correctIndexes.length === 0) return true;
  return attempts.some((attempt) => {
    if (String(attempt.chapterId) !== chapterId || (updatedAt && attempt.at < updatedAt)) return false;
    const questionIndexes = attempt.questionIndexes?.length
      ? attempt.questionIndexes
      : attempt.answers.length === correctIndexes.length
        ? correctIndexes.map((_, index) => index)
        : [];
    if (
      questionIndexes.length !== attempt.answers.length ||
      questionIndexes.some((index) => !Number.isInteger(index) || index < 0 || index >= correctIndexes.length)
    ) return false;
    const score = attempt.answers.reduce(
      (sum, answer, index) => sum + (answer === correctIndexes[questionIndexes[index]] ? 1 : 0),
      0
    );
    return questionIndexes.length > 0 && score / questionIndexes.length >= QUIZ_PASS_THRESHOLD;
  });
}

/** Issues at most one certificate once all readable sections, quizzes, and the final assessment are passed. */
export async function ensureCourseCertificate(courseId: string, userId: string) {
  await connectDB();
  const user = await User.findOne({ _id: userId, role: "user" }).select("name").lean();
  if (!user) return null;
  const [course, chapters, quizzes, assessment, progress] = await Promise.all([
    Course.findOne({ _id: courseId, archivedAt: null }).select("title").lean(),
    Chapter.find({ courseId }).select("_id contentMd").sort({ index: 1 }).lean(),
    Quiz.find({ courseId }).select("chapterId questions updatedAt").lean(),
    CourseFinalAssessment.findOne({ courseId }).select("objectiveQuestions updatedAt").lean(),
    StudentProgress.findOne({ courseId, userId }).select("completedSections quizAttempts finalAssessmentAttempts").lean(),
  ]);
  if (!course || !assessment || assessment.objectiveQuestions.length === 0 || !progress) return null;

  const completedSections = new Map<string, Set<string>>();
  for (const section of progress.completedSections ?? []) {
    const key = String(section.chapterId);
    const items = completedSections.get(key) ?? new Set<string>();
    items.add(section.sectionId);
    completedSections.set(key, items);
  }
  for (const chapter of chapters) {
    const chapterId = String(chapter._id);
    const requiredSections = parseChapterSections(chapter.contentMd).map((section) => section.id);
    const doneSections = completedSections.get(chapterId) ?? new Set<string>();
    if (requiredSections.some((sectionId) => !doneSections.has(sectionId))) return null;

    const quiz = quizzes.find((item) => String(item.chapterId) === chapterId);
    if (quiz && !passedQuizForChapter(
      progress.quizAttempts ?? [],
      chapterId,
      quiz.questions.map((question) => question.correctIndex),
      quiz.updatedAt
    )) return null;
  }

  const correctIndexes = assessment.objectiveQuestions.map((question) => question.correctIndex);
  const passedAttempt = [...(progress.finalAssessmentAttempts ?? [])]
    .reverse()
    .map((attempt) => {
      if (attempt.objectiveAnswers.length !== correctIndexes.length || attempt.at <= assessment.updatedAt) return null;
      const score = attempt.objectiveAnswers.reduce((sum, answer, index) => sum + (answer === correctIndexes[index] ? 1 : 0), 0);
      return score / correctIndexes.length >= QUIZ_PASS_THRESHOLD
        ? { score, total: correctIndexes.length }
        : null;
    })
    .find((attempt) => attempt !== null);
  if (!passedAttempt) return null;

  let certificate = await Certificate.findOne({ userId, courseId }).lean();
  if (!certificate) {
    try {
      certificate = await Certificate.create({
        serial: randomUUID(),
        userId,
        courseId,
        learnerName: user.name,
        courseTitle: course.title,
        objectiveScore: passedAttempt.score,
        objectiveTotal: passedAttempt.total,
      });
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) throw error;
      certificate = await Certificate.findOne({ userId, courseId }).lean();
      if (!certificate) throw error;
    }
  }

  await Notification.updateOne(
    { userId, eventKey: `certificate:${certificate._id}` },
    {
      $setOnInsert: {
        userId,
        type: "certificate",
        title: "Your course certificate is ready",
        message: `You completed ${certificate.courseTitle}. Open your certificate to view and print it.`,
        href: `/certificates/${certificate.serial}`,
        eventKey: `certificate:${certificate._id}`,
      },
    },
    { upsert: true }
  );
  return certificate;
}
