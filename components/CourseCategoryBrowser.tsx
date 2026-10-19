"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatNaira } from "@/lib/currency";

type CourseCategoryItem = { id: string; name: string; count: number };
type PublicCourse = {
  id: string;
  title: string;
  description: string;
  chapterCount: number;
  categoryId: string | null;
  categoryName: string | null;
  hasCover: boolean;
  priceKobo: number | null;
};

export default function CourseCategoryBrowser({
  courses,
  categories,
}: {
  courses: PublicCourse[];
  categories: CourseCategoryItem[];
}) {
  const uncategorizedCount = courses.filter((course) => course.categoryId === null).length;
  const tabs = [
    { id: "all", label: "All courses", count: courses.length },
    ...categories.filter((category) => category.count > 0).map((category) => ({
      id: category.id,
      label: category.name,
      count: category.count,
    })),
    ...(uncategorizedCount
      ? [{ id: "uncategorized", label: "Uncategorized", count: uncategorizedCount }]
      : []),
  ];
  const [activeCategory, setActiveCategory] = useState("all");
  const activeTab = tabs.some((tab) => tab.id === activeCategory) ? activeCategory : "all";

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setActiveCategory(tabs[nextIndex].id);
    document.getElementById(`homepage-category-tab-${tabs[nextIndex].id}`)?.focus();
  }

  const visibleCourses = courses.filter((course) => {
    if (activeTab === "all") return true;
    if (activeTab === "uncategorized") return course.categoryId === null;
    return course.categoryId === activeTab;
  });

  return (
    <>
      {courses.length ? (
        <>
          <div role="tablist" aria-label="Filter courses by category" className="mb-5 flex w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-[#eeece4] p-1 dark:border-slate-700 dark:bg-slate-900">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`homepage-category-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="homepage-course-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveCategory(tab.id)}
                  onKeyDown={handleTabKeyDown}
                  className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${selected ? "bg-[#355f4c] text-white shadow-sm dark:bg-[#9abd9f] dark:text-[#17211d]" : "text-[#355f4c] hover:bg-white dark:text-emerald-100 dark:hover:bg-slate-800"}`}
                >
                  {tab.label}
                  <span className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${selected ? "bg-white/15 text-white dark:bg-[#17211d]/10 dark:text-[#17211d]" : "bg-white text-emerald-900 dark:bg-slate-800 dark:text-emerald-100"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div id="homepage-course-panel" role="tabpanel" aria-labelledby={`homepage-category-tab-${activeTab}`} tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
            <ul className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleCourses.map((course, index) => {
                const coursePrice = course.priceKobo === null ? "Price not set" : formatNaira(course.priceKobo);

                return (
                <li key={course.id} className="group/course relative min-w-0">
                  <Link
                    href={`/courses/${course.id}/overview`}
                    aria-describedby={`course-detail-${course.id}`}
                    className="group block h-full overflow-hidden rounded-xl border border-[#d9d5ca] bg-[#fffdf8] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[#9cac9e] hover:shadow-[0_10px_24px_rgba(36,57,44,0.11)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700"
                  >
                    <span className="relative block aspect-[16/9] overflow-hidden bg-[#dfe7dc] dark:bg-[#26372d]">
                      {course.hasCover ? (
                        <Image
                          src={`/api/courses/${course.id}/cover`}
                          alt={`${course.title} cover`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-end justify-between bg-[linear-gradient(135deg,#e6ebdf_0%,#d2dfd1_48%,#b4c9b9_100%)] p-5 dark:bg-[linear-gradient(135deg,#26372d_0%,#304b3a_54%,#3b5946_100%)]">
                          <span className="line-clamp-3 max-w-[75%] font-serif text-xl leading-tight text-[#294637] dark:text-[#e4eadf]">{course.title}</span>
                          <span aria-hidden="true" className="mb-1 h-10 w-10 shrink-0 rounded-full border border-[#779681]/60 bg-[#fffdf8]/30 dark:border-[#8ba894]/60" />
                        </span>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-[#fffdf8]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#355f4c] dark:bg-[#17211d]/90 dark:text-[#c8ddc8]">
                        {course.categoryName ?? "Course"}
                      </span>
                    </span>
                    <span className="flex min-h-32 flex-col p-4">
                      <span className="block break-words text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{course.title}</span>
                      <span className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>{course.chapterCount} {course.chapterCount === 1 ? "module" : "modules"}</span>
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{coursePrice}</span>
                      </span>
                    </span>
                  </Link>
                  <Link
                    id={`course-detail-${course.id}`}
                    href={`/courses/${course.id}/overview`}
                    aria-label={`View course details: ${course.title}`}
                    className="invisible absolute left-0 top-0 z-30 w-full overflow-hidden rounded-xl border border-[#d9d5ca] bg-[#fffdf8] opacity-0 shadow-[0_14px_32px_rgba(36,57,44,0.2)] transition-[opacity,visibility] duration-150 group-hover/course:visible group-hover/course:opacity-100 group-focus-within/course:visible group-focus-within/course:opacity-100 motion-reduce:transition-none sm:right-auto sm:left-[calc(100%+1rem)] sm:w-full lg:right-auto lg:left-[calc(100%+1rem)] dark:border-slate-600 dark:bg-slate-900"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-[#dfe7dc] dark:bg-[#26372d]">
                      {course.hasCover ? (
                        <Image
                          src={`/api/courses/${course.id}/cover`}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 25vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-end bg-[linear-gradient(135deg,#e6ebdf_0%,#d2dfd1_48%,#b4c9b9_100%)] p-5 dark:bg-[linear-gradient(135deg,#26372d_0%,#304b3a_54%,#3b5946_100%)]">
                          <span className="line-clamp-3 max-w-[80%] font-serif text-xl leading-tight text-[#294637] dark:text-[#e4eadf]">{course.title}</span>
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-[#fffdf8]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#355f4c] dark:bg-[#17211d]/90 dark:text-[#c8ddc8]">
                        {course.categoryName ?? "Course"}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="break-words font-serif text-xl leading-tight text-slate-950 [overflow-wrap:anywhere] dark:text-white">
                        {course.title}
                      </h3>
                      {course.description && (
                        <p className="mt-2 line-clamp-3 break-words text-sm leading-5 text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                          {course.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <span>{course.chapterCount} {course.chapterCount === 1 ? "module" : "modules"}</span>
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{coursePrice}</span>
                      </div>
                    </div>
                  </Link>
                </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : (
        <p className="border-y border-slate-200 bg-white py-7 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          No courses are available yet. Check back soon.
        </p>
      )}
    </>
  );
}
