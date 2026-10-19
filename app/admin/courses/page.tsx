import Link from "next/link";
import { assignCourseCategoryAction } from "@/app/admin/categories/actions";
import CourseManagementActions from "@/components/admin/CourseManagementActions";
import CourseCoverSettings from "@/components/admin/CourseCoverSettings";
import CourseCategorySelect from "@/components/admin/CourseCategorySelect";
import { assignCourseInstructorAction } from "./actions";
import { connectDB } from "@/lib/db";
import { Course, CourseMedia } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { User } from "@/lib/models/User";

export const dynamic = "force-dynamic";

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));

const statusLabel = (status: string) =>
  status === "comingSoon" ? "Coming soon" : status.charAt(0).toUpperCase() + status.slice(1);

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string; instructor?: string; q?: string }>;
}) {
  const params = await searchParams;
  const archived = params.view === "archive";
  const search = params.q?.trim().slice(0, 100) ?? "";
  const courseFilter = {
    archivedAt: archived ? { $ne: null } : null,
    ...(search ? { title: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } } : {}),
  };
  await connectDB();
  const [courses, activeCount, archivedCount, categories, instructors] = await Promise.all([
    Course.find(courseFilter)
      .sort({ updatedAt: -1 })
      .select("title status format chapterCount createdAt categoryId instructorId")
      .lean(),
    Course.countDocuments({ archivedAt: null }),
    Course.countDocuments({ archivedAt: { $ne: null } }),
    CourseCategory.find().sort({ name: 1 }).select("name").lean(),
    User.find({ role: "instructor" }).sort({ name: 1 }).select("name email").lean(),
  ]);
  const coursesWithCovers = new Set(
    courses.length
      ? (await CourseMedia.find({ courseId: { $in: courses.map((course) => course._id) }, index: -1 })
          .distinct("courseId"))
          .map(String)
      : [],
  );
  const instructorsById = new Map(instructors.map((instructor) => [String(instructor._id), instructor]));
  const instructorNotice = {
    saved: "Course instructor assignment updated.",
    invalid: "Choose an account with the instructor role.",
    missing: "The course could not be found.",
  }[params.instructor ?? ""];
  const notice = params.category === "saved"
    ? "Course category updated."
    : params.category === "invalid"
      ? "Choose a valid course and category."
      : params.category === "missing"
        ? "The course could not be found."
        : undefined;

  return (
    <section aria-labelledby="courses-heading" className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="courses-heading" className="text-xl font-semibold text-slate-950">Course library</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Manage active courses or restore courses from the archive. Set a user to Instructor in User management before assigning them here. Archived courses are hidden from students until restored.
        </p>
      </header>

      {notice && (
        <p role={params.category === "saved" ? "status" : "alert"} className={`border px-4 py-3 text-sm ${params.category === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {notice}
        </p>
      )}
      {instructorNotice && (
        <p role={params.instructor === "saved" ? "status" : "alert"} className={`border px-4 py-3 text-sm ${params.instructor === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {instructorNotice}
        </p>
      )}

      <nav aria-label="Course library views" className="flex gap-6 border-b border-slate-200 text-sm">
        <Link
          href={search ? `/admin/courses?q=${encodeURIComponent(search)}` : "/admin/courses"}
          aria-current={!archived ? "page" : undefined}
          className={`border-b-2 py-3 ${!archived ? "border-blue-700 font-medium text-blue-800" : "border-transparent text-slate-600 hover:text-blue-700"}`}
        >
          Active <span className="ml-1 tabular-nums text-slate-500">{activeCount}</span>
        </Link>
        <Link
          href={`/admin/courses?${new URLSearchParams({ ...(search ? { q: search } : {}), view: "archive" }).toString()}`}
          aria-current={archived ? "page" : undefined}
          className={`border-b-2 py-3 ${archived ? "border-blue-700 font-medium text-blue-800" : "border-transparent text-slate-600 hover:text-blue-700"}`}
        >
          Archive <span className="ml-1 tabular-nums text-slate-500">{archivedCount}</span>
        </Link>
      </nav>

      <form action="/admin/courses" method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {archived && <input type="hidden" name="view" value="archive" />}
        <label htmlFor="course-search" className="min-w-0 flex-1 text-sm font-medium text-slate-700">
          Search courses
          <input
            id="course-search"
            name="q"
            type="search"
            defaultValue={search}
            maxLength={100}
            placeholder="Enter a course title"
            className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          />
        </label>
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-emerald-900 bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            Search
          </button>
          {search && (
            <Link
              href={archived ? "/admin/courses?view=archive" : "/admin/courses"}
              className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
            >
              Clear
            </Link>
          )}
        </div>
      </form>
      {search && (
        <p role="status" className="text-sm text-slate-600">
          {courses.length} {courses.length === 1 ? "course" : "courses"} found for “{search}”.
        </p>
      )}

      {courses.length ? (
        <div className="overflow-x-auto border-y border-slate-200 bg-white">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Course</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Instructor</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => {
                const id = String(course._id);
                return (
                  <tr key={id}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{course.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {course.format === "video" ? "Video course" : "Document course"} · {course.chapterCount} {course.format === "video" ? "lessons" : "modules"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <form action={assignCourseCategoryAction} className="flex min-w-56 items-end gap-2">
                        <input type="hidden" name="courseId" value={id} />
                        <div className="min-w-0 flex-1">
                          <CourseCategorySelect
                            id={`course-category-${id}`}
                            categories={categories.map((category) => ({ id: String(category._id), name: category.name }))}
                            defaultValue={course.categoryId ? String(course.categoryId) : ""}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={categories.length === 0}
                          className="min-h-11 shrink-0 border border-emerald-900 bg-emerald-900 px-3 text-xs font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                        >
                          Assign
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-4">
                      <form action={assignCourseInstructorAction} className="flex min-w-56 items-end gap-2">
                        <input type="hidden" name="courseId" value={id} />
                        <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                          <span className="sr-only">Instructor for {course.title}</span>
                          <select
                            name="instructorId"
                            defaultValue={course.instructorId ?? ""}
                            className="min-h-10 w-full border border-slate-300 bg-white px-2 text-xs text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                          >
                            <option value="">Unassigned</option>
                            {course.instructorId && !instructorsById.has(course.instructorId) && (
                              <option value={course.instructorId}>Former instructor</option>
                            )}
                            {instructors.map((instructor) => (
                              <option key={String(instructor._id)} value={String(instructor._id)}>
                                {instructor.name} · {instructor.email}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          className="min-h-10 shrink-0 border border-blue-700 px-3 text-xs font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          Assign
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{statusLabel(course.status)}</td>
                    <td className="px-4 py-4 tabular-nums text-slate-500">{dateLabel(course.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-3">
                        <CourseCoverSettings
                          courseId={id}
                          courseTitle={course.title}
                          hasCover={coursesWithCovers.has(id)}
                          archived={archived}
                        />
                        {!archived && (
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
                            <Link href={`/courses/${id}`} className="text-blue-700 hover:text-blue-900">Open</Link>
                            {(course.status === "comingSoon" || course.status === "failed") && (
                              <Link href={`/admin/courses/${id}`} className="text-blue-700 hover:text-blue-900">Add materials</Link>
                            )}
                            {course.status === "ready" && (
                              <Link href={`/courses/${id}/edit`} className="text-blue-700 hover:text-blue-900">Edit</Link>
                            )}
                            <Link href={`/courses/${id}/students`} className="text-blue-700 hover:text-blue-900">Students</Link>
                          </div>
                        )}
                        <CourseManagementActions courseId={id} courseTitle={course.title} archived={archived} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-y border-slate-200 py-8">
          <h3 className="font-medium text-slate-900">
            {search ? "No matching courses" : archived ? "The archive is empty" : "No active courses"}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {search
              ? "Try a different course title or clear your search to see all courses."
              : archived
              ? "When you archive a course, it will appear here and can be restored at any time."
              : "Courses you create will appear here. You can archive them whenever they should no longer be available to students."}
          </p>
        </div>
      )}
    </section>
  );
}
