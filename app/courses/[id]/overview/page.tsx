import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { formatNaira } from "@/lib/currency";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { Chapter, Course, CourseRestriction, Quiz } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

function OverviewList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <section aria-label={title} className="border-t border-slate-200 pt-5 dark:border-slate-700">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {items.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600 marker:text-amber-700 dark:text-slate-300 dark:marker:text-amber-300">
          {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      )}
    </section>
  );
}

const statusCopy = {
  comingSoon: "Coming soon",
  processing: "Course materials are being prepared",
  ready: "Ready to study",
  failed: "Course materials are being updated",
} as const;

export default async function CourseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  if (!isValidObjectId(id)) notFound();

  await connectDB();
  const course = await Course.findOne({ _id: id, catalogVisible: true, archivedAt: null })
    .select("title description priceKobo status topics learningOutcomes prerequisites skills tools careerBenefits jobRoles")
    .lean();
  if (!course) notFound();

  const userId = session?.user?.id;
  if (userId && await CourseRestriction.exists({ userId, courseId: id })) notFound();

  const [chapters, quizzes, access] = await Promise.all([
    Chapter.find({ courseId: id }).sort({ index: 1 }).select("index title summary").lean(),
    Quiz.aggregate<{ chapterId: unknown; questionCount: number }>([
      { $match: { courseId: course._id } },
      { $project: { chapterId: 1, questionCount: { $size: "$questions" } } },
    ]),
    userId ? getCourseAccess(id, userId, { allowCatalogPreview: true }) : Promise.resolve(null),
  ]);

  const quizCounts = new Map(quizzes.map((quiz) => [String(quiz.chapterId), quiz.questionCount]));
  const quizChapterCount = chapters.reduce((total, chapter) => total + (quizCounts.get(String(chapter._id)) ? 1 : 0), 0);
  const hasStudyAccess = access?.role === "owner" || access?.role === "instructor" || access?.role === "student";
  const studyHref = `/courses/${id}`;
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(studyHref)}`;
  const ownerNeedsMaterials = access?.role === "owner" && course.status !== "ready";
  const canPurchase = course.status === "ready" && typeof course.priceKobo === "number";
  const actionHref = ownerNeedsMaterials
    ? `/admin/courses/${id}`
    : hasStudyAccess
      ? studyHref
      : canPurchase
        ? userId ? studyHref : signupHref
        : null;
  const actionLabel = ownerNeedsMaterials
    ? "Add study materials"
    : hasStudyAccess
      ? "Continue learning"
      : canPurchase
        ? userId ? "Get course access" : "Sign up to get access"
        : course.status === "ready" ? "Price not set yet" : statusCopy[course.status];

  return (
    <>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-7 md:px-10 md:pt-10">
        <nav aria-label="Breadcrumb" className="mb-7 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="underline-offset-4 hover:text-blue-800 hover:underline dark:hover:text-blue-300">Home</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <Link href={userId ? "/courses" : "/#available-courses"} className="underline-offset-4 hover:text-blue-800 hover:underline dark:hover:text-blue-300">Courses</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page" className="text-slate-700 dark:text-slate-200">{course.title}</span>
        </nav>

        <header className="grid gap-8 border-b border-slate-300 pb-8 dark:border-slate-700 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-14">
          <div>
            <h1 className="max-w-4xl font-serif text-4xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              {course.title}
            </h1>
            {course.description && (
              <p className="mt-5 max-w-[72ch] text-base leading-7 text-slate-600 dark:text-slate-300">
                {course.description}
              </p>
            )}
            <p className="mt-5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {statusCopy[course.status]}
            </p>
          </div>

          <aside aria-label="Course access" className="border-y border-slate-300 py-5 dark:border-slate-700 lg:border-y-0 lg:border-l lg:py-2 lg:pl-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Course price</p>
            <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">
              {typeof course.priceKobo === "number" ? formatNaira(course.priceKobo) : "Not set"}
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {chapters.length} {chapters.length === 1 ? "module" : "modules"}
              {" · "}
              {quizChapterCount} {quizChapterCount === 1 ? "module quiz" : "module quizzes"}
            </p>
            {actionHref ? (
              <Link
                href={actionHref}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                {actionLabel}
              </Link>
            ) : (
              <p role="status" className="mt-5 border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {actionLabel}
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {canPurchase ? "One-time course access. A valid course promo code can be applied at checkout." : "Course access opens when materials and pricing are ready."}
            </p>
          </aside>
        </header>

        <div className="grid gap-10 py-9 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)] lg:gap-16">
          <div className="space-y-10">
            <section aria-labelledby="learning-plan-heading">
              <h2 id="learning-plan-heading" className="font-serif text-2xl font-semibold text-slate-950 dark:text-white">Course learning plan</h2>
              <div className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2">
                <OverviewList
                  title="What you’ll study"
                  items={course.topics ?? []}
                  emptyMessage="The course topics will appear here when the study materials have been prepared."
                />
                <OverviewList
                  title="What you’ll learn"
                  items={course.learningOutcomes ?? []}
                  emptyMessage="Learning outcomes will be generated from the course material."
                />
              </div>
            </section>

            <section aria-labelledby="modules-heading">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-4 dark:border-slate-700">
                <div>
                  <h2 id="modules-heading" className="font-serif text-2xl font-semibold text-slate-950 dark:text-white">Modules and quizzes</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Preview the course structure and practice available in each module.</p>
                </div>
                <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{chapters.length} modules</span>
              </div>
              {chapters.length ? (
                <ol className="divide-y divide-slate-200 dark:divide-slate-800">
                  {chapters.map((chapter, index) => {
                    const questionCount = quizCounts.get(String(chapter._id)) ?? 0;
                    return (
                      <li key={String(chapter._id)} className="grid gap-2 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-4">
                        <span className="font-serif text-lg tabular-nums text-amber-700 dark:text-amber-300">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{chapter.title}</h3>
                          {chapter.summary && <p className="mt-1 max-w-[70ch] text-sm leading-6 text-slate-600 dark:text-slate-300">{chapter.summary}</p>}
                        </div>
                        <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400 sm:text-right">
                          {questionCount ? `Module quiz · ${questionCount} ${questionCount === 1 ? "question" : "questions"}` : "No module quiz"}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="border-b border-slate-200 py-5 text-sm leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  The module outline and quizzes will appear here when course materials are ready.
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-9">
            <section aria-labelledby="preparation-heading">
              <h2 id="preparation-heading" className="font-serif text-2xl font-semibold text-slate-950 dark:text-white">Before you begin</h2>
              <div className="mt-5 space-y-6">
                <OverviewList
                  title="Prerequisites"
                  items={course.prerequisites ?? []}
                  emptyMessage="Any recommended prior knowledge will be listed here."
                />
                <OverviewList
                  title="Skills covered"
                  items={course.skills ?? []}
                  emptyMessage="Course skills will be listed when the learning plan is generated."
                />
                <OverviewList
                  title="Tools and technologies"
                  items={course.tools ?? []}
                  emptyMessage="Required tools will be listed when the learning plan is generated."
                />
              </div>
            </section>

            <section aria-labelledby="career-heading" className="border-t border-slate-300 pt-6 dark:border-slate-700">
              <h2 id="career-heading" className="font-serif text-2xl font-semibold text-slate-950 dark:text-white">Career relevance</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Possible ways these skills can support further learning and work—without guaranteeing a specific outcome.</p>
              <div className="mt-5 space-y-6">
                <OverviewList
                  title="Career benefits"
                  items={course.careerBenefits ?? []}
                  emptyMessage="Career-related applications will be described when the course guide is generated."
                />
                <OverviewList
                  title="Related job roles"
                  items={course.jobRoles ?? []}
                  emptyMessage="Relevant roles will be listed based on the skills taught in this course."
                />
              </div>
            </section>
          </aside>
        </div>

        <footer className="border-t border-slate-300 pt-5 text-sm dark:border-slate-700">
          <Link href={userId ? "/courses" : "/#available-courses"} className="font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-300">
            Back to courses
          </Link>
        </footer>
      </main>
    </>
  );
}
