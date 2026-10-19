import { notFound, redirect } from "next/navigation";
import CourseEditor, { type Ch } from "@/components/CourseEditor";
import ManageTabs from "@/components/ManageTabs";
import { authorizeCourseEditor, getCourseAccess } from "@/lib/access";
import { getUserId, isAdmin } from "@/lib/auth";
import { Chapter, CourseFinalAssessment, Quiz } from "@/lib/models/Course";
import { protectCourseMediaUrls } from "@/lib/videoProtection";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  const access = await getCourseAccess(id, userId);
  const admin = access?.role !== "owner" && access?.role !== "instructor" && await isAdmin(userId);
  const instructor = access?.role === "instructor";
  const canManageCodePractice = await isAdmin(userId);
  if ((!access || (access.role !== "owner" && access.role !== "instructor")) && !admin) notFound();
  const editorAccess = await authorizeCourseEditor(id);
  if (editorAccess instanceof Response) notFound();
  const { course } = editorAccess;

  const [chapters, quizzes, finalAssessment] = await Promise.all([
    Chapter.find({ courseId: id }).sort({ index: 1 }).lean(),
    Quiz.find({ courseId: id }).lean(),
    CourseFinalAssessment.findOne({ courseId: id }).lean(),
  ]);
  if (course.status !== "ready" || chapters.length === 0) redirect(`/courses/${id}`);

  const quizBy = new Map(quizzes.map((q) => [String(q.chapterId), q.questions]));
  const initial: Ch[] = chapters.map((c) => ({
    id: String(c._id),
    title: c.title,
    contentMd: protectCourseMediaUrls(c.contentMd, id),
    videoUrl: c.videoUrl ?? "",
    quiz: (quizBy.get(String(c._id)) ?? []).map((q) => ({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    })),
  }));

  return (
    <>
      <ManageTabs courseId={id} title={course.title} active="edit" admin={admin} instructor={instructor} />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        {admin && (
          <p className="mb-6 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            You are editing this course as an administrator. Owner-only sharing and student analytics remain with the course owner.
          </p>
        )}
        {instructor && (
          <p className="mb-6 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            You are assigned to edit this course. Course sharing, student analytics, and administrator settings remain restricted.
          </p>
        )}
        <CourseEditor
          courseId={id}
          initialTitle={course.title}
          initialDescription={course.description ?? ""}
          initialCodePracticeEnabled={course.codePracticeEnabled ?? false}
          canManageCodePractice={canManageCodePractice}
          isVideoCourse={course.format === "video"}
          initialChapters={initial}
          initialFinalAssessment={finalAssessment ? {
            objectiveQuestions: finalAssessment.objectiveQuestions.map((question) => ({
              question: question.question,
              options: [...question.options],
              correctIndex: question.correctIndex,
              explanation: question.explanation,
            })),
            theoryQuestions: finalAssessment.theoryQuestions.map((question) => ({
              question: question.question,
              sampleAnswer: question.sampleAnswer,
              gradingPoints: [...question.gradingPoints],
            })),
          } : null}
        />
      </main>
    </>
  );
}
