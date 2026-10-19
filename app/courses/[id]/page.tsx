import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import CoursePurchasePanel from "@/components/CoursePurchasePanel";
import BuildProgress from "@/components/BuildProgress";
import ChapterReader, { type ChapterView } from "@/components/reader/ChapterReader";
import { connectDB } from "@/lib/db";
import { getCourseAccess } from "@/lib/access";
import { recordCohortActivity } from "@/lib/cohortActivity";
import { Chapter, CourseFinalAssessment, Quiz, StudentNote, StudentProgress } from "@/lib/models/Course";
import { Certificate } from "@/lib/models/LearningFeatures";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { UserProfile } from "@/lib/models/UserProfile";
import { protectCourseMediaUrls } from "@/lib/videoProtection";
import { passedQuizForChapter } from "@/lib/certificates";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isValidObjectId(id)) notFound();

  const session = await auth();
  if (!session?.user) redirect("/signin");
  const userId = session.user.id;
  const studentName = session.user.name?.trim() || session.user.email?.split("@")[0] || "there";
  await connectDB();
  const access = await getCourseAccess(id, userId, { allowCatalogPreview: true });
  if (!access) notFound();
  const { course } = access;
  if (access.role === "student") {
    await recordCohortActivity({
      userId,
      type: "course-opened",
      courseId: id,
      label: `Opened course: ${course.title}`,
    });
  }

  if (access.role === "purchase" && course.status === "ready") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-12 md:px-10 md:py-16">
          <CoursePurchasePanel
            courseId={id}
            title={course.title}
            description={course.description}
            priceKobo={typeof course.priceKobo === "number" ? course.priceKobo : null}
            paymentStatus={query.payment}
          />
        </main>
      </>
    );
  }

  if (course.status === "comingSoon") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Coming soon</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
          {course.description && <p className="mt-4 max-w-[65ch] text-sm leading-6 text-slate-600">{course.description}</p>}
          <p className="mt-5 text-sm leading-6 text-slate-600">Study materials are being prepared. Check back later to study this course.</p>
          {access.role === "owner" && (
            <Link href={`/admin/courses/${id}`} className="mt-7 inline-flex border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              Add study materials
            </Link>
          )}
          <Link href="/courses" className="mt-7 block text-sm font-medium text-blue-700 hover:text-blue-900">Back to courses</Link>
        </main>
      </>
    );
  }

  const [chapters, quizzes, progress, settings, profile, finalAssessment, savedNotes, certificate] = await Promise.all([
    Chapter.find({ courseId: id }).sort({ index: 1 }).lean(),
    Quiz.find({ courseId: id }).lean(),
    StudentProgress.findOne({ userId, courseId: id }).lean(),
    PlatformSettings.findOne({ key: "platform" }).select("studentQuizQuestionLimit").lean(),
    UserProfile.findOne({ userId }).select("displayName avatarData").lean(),
    CourseFinalAssessment.findOne({ courseId: id }).lean(),
    StudentNote.find({ userId, courseId: id }).select("chapterId content").lean(),
    Certificate.findOne({ userId, courseId: id }).select("serial").lean(),
  ]);

  if (course.status === "processing") {
    if (access.role === "catalog") {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Coming soon</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
            <p className="mt-5 text-sm leading-6 text-slate-600">Study materials are being prepared. Check back later to study this course.</p>
            <Link href="/courses" className="mt-7 inline-block text-sm font-medium text-blue-700 hover:text-blue-900">Back to courses</Link>
          </main>
        </>
      );
    }
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
          <BuildProgress
            courseId={id}
            initial={{
              status: "processing",
              stage: course.stage ?? "queued",
              title: course.title,
              totalChapters: course.totalChapters ?? 0,
              lecturesDone: course.lecturesDone ?? 0,
              quizzesDone: course.quizzesDone ?? 0,
            }}
          />
        </main>
      </>
    );
  }

  if (course.status === "failed" || chapters.length === 0) {
    if (access.role === "catalog") {
      return (
        <>
          <SiteHeader />
          <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Coming soon</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
            <p className="mt-5 text-sm leading-6 text-slate-600">Study materials are being updated. Check back later to study this course.</p>
            <Link href="/courses" className="mt-7 inline-block text-sm font-medium text-blue-700 hover:text-blue-900">Back to courses</Link>
          </main>
        </>
      );
    }
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-16 md:px-10">
          <h1 className="text-2xl font-semibold">This course could not be built</h1>
          <p className="mt-4 border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
            {course.error ?? "Something went wrong. Upload the document again."}
          </p>
          <Link href="/courses" className="mt-6 inline-block text-sm underline underline-offset-4 text-blue-700">
            Back to your courses
          </Link>
        </main>
      </>
    );
  }

  const quizByChapter = new Map(quizzes.map((q) => [String(q.chapterId), q]));
  const quizQuestionLimit = access.role === "owner"
    ? 15
    : Math.min(15, Math.max(1, settings?.studentQuizQuestionLimit ?? 15));
  const views: ChapterView[] = chapters.map((c) => ({
    id: String(c._id),
    index: c.index,
    title: c.title,
    contentMd: protectCourseMediaUrls(c.contentMd, id),
    videoUrl: c.videoUrl ?? "",
    quiz: (quizByChapter.get(String(c._id))?.questions ?? []).slice(0, quizQuestionLimit).map((q) => ({
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    })),
  }));

  return (
    <>
      <SiteHeader />
      <ChapterReader
        courseId={id}
        courseTitle={course.title}
        initialCertificateUrl={certificate ? `/certificates/${certificate.serial}` : null}
        canViewProjects={["owner", "instructor", "student"].includes(access.role)}
        studentName={profile?.displayName || studentName}
        studentAvatar={profile?.avatarData || ""}
        isOwner={access.role === "owner"}
        isVideoCourse={course.format === "video"}
        codePracticeEnabled={course.codePracticeEnabled ?? false}
        chapters={views}
        completedSections={Object.fromEntries(
          (progress?.completedSections ?? []).reduce<Map<string, string[]>>((byChapter, section) => {
            const chapterId = String(section.chapterId);
            byChapter.set(chapterId, [...(byChapter.get(chapterId) ?? []), section.sectionId]);
            return byChapter;
          }, new Map())
        )}
        notesByChapter={Object.fromEntries(savedNotes.map((note) => [String(note.chapterId), note.content]))}
        finalAssessment={finalAssessment ? {
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
        completedIds={[
          ...chapters
            .filter((chapter) => {
              const quiz = quizByChapter.get(String(chapter._id));
              return quiz && passedQuizForChapter(
                progress?.quizAttempts ?? [],
                String(chapter._id),
                quiz.questions.slice(0, quizQuestionLimit).map((question) => question.correctIndex),
                quiz.updatedAt
              );
            })
            .map((chapter) => String(chapter._id)),
        ]}
      />
    </>
  );
}
