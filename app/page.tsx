import Link from "next/link";
import { auth } from "@/auth";
import SiteHeader from "@/components/SiteHeader";
import CodeShowcase from "@/components/CodeShowcase";
import CourseCategoryBrowser from "@/components/CourseCategoryBrowser";
import { connectDB } from "@/lib/db";
import { Course, CourseMedia, CourseRestriction } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { defaultHomepageContent, HomepageContent } from "@/lib/models/HomepageContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  await connectDB();
  const restrictedIds = session?.user
    ? await CourseRestriction.find({ userId: session.user.id }).distinct("courseId")
    : [];
  const [savedContent, availableCourses, categories] = await Promise.all([
    HomepageContent.findOne({ key: "home" }).lean(),
    Course.find({ catalogVisible: true, status: "ready", archivedAt: null, _id: { $nin: restrictedIds } })
      .sort({ title: 1 })
      .select("title description chapterCount categoryId priceKobo")
      .lean(),
    CourseCategory.find().sort({ name: 1 }).select("name").lean(),
  ]);
  const coverMedia = availableCourses.length
    ? await CourseMedia.find({ courseId: { $in: availableCourses.map((course) => course._id) }, index: -1 })
    .select("courseId")
    .lean()
    : [];
  const courseIdsWithCovers = new Set(coverMedia.map((media) => String(media.courseId)));
  const content = savedContent
    ? { ...defaultHomepageContent, ...savedContent }
    : defaultHomepageContent;
  const categoryNames = new Map(categories.map((category) => [String(category._id), category.name]));
  const coursesForBrowser = availableCourses.map((course) => {
    const categoryId = course.categoryId ? String(course.categoryId) : null;
    return {
      id: String(course._id),
      title: course.title,
      description: course.description,
      chapterCount: course.chapterCount,
      categoryId,
      categoryName: categoryId ? categoryNames.get(categoryId) ?? null : null,
      hasCover: courseIdsWithCovers.has(String(course._id)),
      priceKobo: typeof course.priceKobo === "number" ? course.priceKobo : null,
    };
  });
  const categoryCounts = new Map<string, number>();
  coursesForBrowser.forEach((course) => {
    if (course.categoryId) categoryCounts.set(course.categoryId, (categoryCounts.get(course.categoryId) ?? 0) + 1);
  });
  const categoriesForBrowser = categories.map((category) => ({
    id: String(category._id),
    name: category.name,
    count: categoryCounts.get(String(category._id)) ?? 0,
  }));

  return (
    <>
      <SiteHeader />
      <main>
        <section className="home-hero border-b">
          <div className="home-hero__inner mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:px-10 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-16">
            <div className="order-2 lg:order-1">
              <h1 className="max-w-[15ch] text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
                {content.heroTitle}
              </h1>
              <p className="mt-6 max-w-[52ch] text-base leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
                {content.heroDescription}
              </p>
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Guided lessons</span><span aria-hidden="true" className="text-amber-700 dark:text-amber-300">/</span>
                <span>Practice and quizzes</span><span aria-hidden="true" className="text-amber-700 dark:text-amber-300">/</span>
                <span>Saved progress</span>
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="#available-courses"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-blue-800 bg-blue-800 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,48,42,0.12)] transition-all hover:-translate-y-0.5 hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  {content.primaryCta}
                </Link>
                <Link
                  href="/signin"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:text-blue-300"
                >
                  {content.secondaryCta}
                </Link>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{content.heroFootnote}</p>
            </div>

            <div className="order-1 mx-auto w-full max-w-[520px] lg:order-2 lg:ml-auto">
              <CodeShowcase label={content.codeExampleLabel} />
            </div>
          </div>
        </section>

        <section id="available-courses" className="scroll-mt-20 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-12">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">Available courses</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Browse published courses and start studying.</p>
              </div>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{coursesForBrowser.length} {coursesForBrowser.length === 1 ? "course" : "courses"}</span>
            </header>

            <CourseCategoryBrowser courses={coursesForBrowser} categories={categoriesForBrowser} />
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0b1220]">
          <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-16">
            <header className="mb-8 max-w-2xl">
              <h2 className="font-serif text-3xl font-semibold leading-tight text-[#26312d] dark:text-[#f2eee4] sm:text-4xl">
                Learn with every step in view.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                Lessons, practice, and progress come together in a focused course workspace.
              </p>
            </header>
            <div className="grid gap-x-8 gap-y-7 border-t border-[#d9d5ca] pt-6 dark:border-[#394941] md:grid-cols-3">
              <article className="md:border-r md:border-[#d9d5ca] md:pr-8 dark:md:border-[#394941]">
                <h3 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Study structured lessons</h3>
                <p className="mt-3 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                  Follow course modules, read lesson materials, watch course videos, and keep personal notes close to your study.
                </p>
              </article>
              <article className="md:border-r md:border-[#d9d5ca] md:pr-8 dark:md:border-[#394941]">
                <h3 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Practice as you go</h3>
                <p className="mt-3 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                  Check your understanding with module quizzes and final assessments. Some courses also include interactive code practice.
                </p>
              </article>
              <article>
                <h3 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Keep your place</h3>
                <p className="mt-3 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                  See your completed lessons, return to your progress, and ask the course assistant questions while you learn.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-t border-[#d9d5ca] bg-[#eeece4] dark:border-[#394941] dark:bg-slate-900">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:px-10 md:py-16">
            <div>
              <h2 className="max-w-[18ch] font-serif text-3xl font-semibold leading-tight text-[#26312d] dark:text-[#f2eee4] sm:text-4xl">
                For instructors: teach and manage in one place.
              </h2>
              <p className="mt-4 max-w-[42ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                Create a course from teaching materials, shape it for your learners, and keep course activity visible.
              </p>
              <Link href="/signin" className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#355f4c] underline underline-offset-4 hover:text-[#26312d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 dark:text-[#b5c9b5] dark:hover:text-white">
                Sign in to your workspace
              </Link>
            </div>
            <dl className="divide-y divide-[#d3d0c6] border-y border-[#d3d0c6] dark:divide-[#394941] dark:border-[#394941]">
              <div className="grid gap-2 py-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
                <dt className="font-serif text-lg font-semibold text-[#26312d] dark:text-[#f2eee4]">Build and edit courses</dt>
                <dd className="text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                  Turn a document into structured lessons and quizzes, or create video lessons. Review and edit course content before learners study.
                </dd>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
                <dt className="font-serif text-lg font-semibold text-[#26312d] dark:text-[#f2eee4]">Set access and share</dt>
                <dd className="text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                  Set course pricing and sharing. Learners can gain access through a purchase, a valid promo code, or an assigned cohort.
                </dd>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
                <dt className="font-serif text-lg font-semibold text-[#26312d] dark:text-[#f2eee4]">Review learner activity</dt>
                <dd className="text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                  Use course analytics to follow learner progress and quiz results.
                </dd>
              </div>
            </dl>
          </div>
        </section>

      </main>
    </>
  );
}
