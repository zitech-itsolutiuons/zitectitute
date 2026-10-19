"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/currency";

type CourseRow = {
  id: string;
  title: string;
  description?: string | null;
  note: string;
  roleLabel?: string;
  action?: string;
  href?: string;
  priceKobo: number | null;
  completed?: number;
  total?: number;
};

function CourseList({ rows, emptyMessage, enrolled = false }: { rows: CourseRow[]; emptyMessage: string; enrolled?: boolean }) {
  if (rows.length === 0) {
    return <p className="border-y border-slate-200 py-7 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{emptyMessage}</p>;
  }

  return (
    <ul className="course-list">
      {rows.map((course) => (
        <li key={course.id}>
          <Link
            href={course.href ?? `/courses/${course.id}`}
            className="course-list__link block px-4 py-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:px-5 dark:hover:bg-slate-800"
          >
            <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-5">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{course.title}</p>
                {course.description && <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">{course.description}</p>}
                <p className="mt-2 break-words text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{course.note}</p>
              </div>
              <div className="w-28 shrink-0 text-right sm:w-36">
                {course.roleLabel ? (
                  <span className="inline-flex border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    {course.roleLabel}
                  </span>
                ) : enrolled ? (
                  <span className="inline-flex border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    Enrolled
                  </span>
                ) : (
                  <>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Course price</p>
                    <p className="mt-0.5 break-words text-xl font-bold tabular-nums leading-tight text-emerald-800 dark:text-emerald-300 sm:text-2xl">
                      {course.priceKobo === null ? "Not set" : formatNaira(course.priceKobo)}
                    </p>
                  </>
                )}
                <p className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300">{course.action ?? "Open"}</p>
              </div>
            </div>
            {typeof course.completed === "number" && typeof course.total === "number" && course.total > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label={`${course.title} completion`}
                  aria-valuenow={Math.round((course.completed / course.total) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 min-w-0 flex-1 bg-slate-100 dark:bg-slate-700"
                >
                  <div className="h-full bg-blue-700 dark:bg-blue-400" style={{ width: `${Math.round((course.completed / course.total) * 100)}%` }} />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{course.completed}/{course.total}</span>
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CourseDashboardTabs({
  myCourses,
  availableCourses,
}: {
  myCourses: CourseRow[];
  availableCourses: CourseRow[];
}) {
  const [activeTab, setActiveTab] = useState<"my-courses" | "available-courses">("my-courses");

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const tabs = ["my-courses", "available-courses"] as const;
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex]);
    document.getElementById(`course-tab-${tabs[nextIndex]}`)?.focus();
  }

  const showingMyCourses = activeTab === "my-courses";

  return (
    <section aria-labelledby="courses-heading" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 id="courses-heading" className="text-lg font-semibold text-slate-900 dark:text-white">Courses</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {showingMyCourses ? "Courses you own, have been assigned to edit, or have unlocked." : "Published courses and upcoming study materials."}
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Course lists" className="mb-4 flex w-full gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 sm:w-fit dark:border-slate-700 dark:bg-slate-900">
        <button
          id="course-tab-my-courses"
          type="button"
          role="tab"
          aria-selected={showingMyCourses}
          aria-controls="course-panel-my-courses"
          tabIndex={showingMyCourses ? 0 : -1}
          onClick={() => setActiveTab("my-courses")}
          onKeyDown={handleTabKeyDown}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:flex-none ${showingMyCourses ? "bg-emerald-900 text-white shadow-sm dark:bg-emerald-200 dark:text-emerald-950" : "text-emerald-900 hover:bg-white hover:text-emerald-950 dark:text-emerald-100 dark:hover:bg-slate-800 dark:hover:text-white"}`}
        >
          My courses
          <span className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${showingMyCourses ? "bg-white/15 text-white dark:bg-emerald-950/10 dark:text-emerald-950" : "bg-white text-emerald-900 dark:bg-slate-800 dark:text-emerald-100"}`}>
            {myCourses.length}
          </span>
        </button>
        <button
          id="course-tab-available-courses"
          type="button"
          role="tab"
          aria-selected={!showingMyCourses}
          aria-controls="course-panel-available-courses"
          tabIndex={showingMyCourses ? -1 : 0}
          onClick={() => setActiveTab("available-courses")}
          onKeyDown={handleTabKeyDown}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:flex-none ${!showingMyCourses ? "bg-emerald-900 text-white shadow-sm dark:bg-emerald-200 dark:text-emerald-950" : "text-emerald-900 hover:bg-white hover:text-emerald-950 dark:text-emerald-100 dark:hover:bg-slate-800 dark:hover:text-white"}`}
        >
          Explore courses
          <span className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${!showingMyCourses ? "bg-white/15 text-white dark:bg-emerald-950/10 dark:text-emerald-950" : "bg-white text-emerald-900 dark:bg-slate-800 dark:text-emerald-100"}`}>
            {availableCourses.length}
          </span>
        </button>
      </div>

      <div
        id="course-panel-my-courses"
        role="tabpanel"
        aria-labelledby="course-tab-my-courses"
        tabIndex={0}
        hidden={!showingMyCourses}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <CourseList
          rows={myCourses}
          emptyMessage="No courses unlocked yet. Join a course with a code or explore the catalog."
          enrolled
        />
      </div>
      <div
        id="course-panel-available-courses"
        role="tabpanel"
        aria-labelledby="course-tab-available-courses"
        tabIndex={0}
        hidden={showingMyCourses}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <CourseList
          rows={availableCourses}
          emptyMessage="No courses have been published yet."
        />
      </div>
    </section>
  );
}
