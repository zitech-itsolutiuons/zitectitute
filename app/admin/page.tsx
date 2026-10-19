import Link from "next/link";
import { redirect } from "next/navigation";
import UploadForm from "@/components/UploadForm";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { User } from "@/lib/models/User";
import ComingSoonCourseForm from "@/components/admin/ComingSoonCourseForm";

export const dynamic = "force-dynamic";

const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const adminId = await getUserId();
  if (!adminId) redirect("/signin");
  await connectDB();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [userCount, adminCount, newUserCount, courseCount, courseStatuses, recentUsers, managedCourses, categories] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ createdAt: { $gte: since } }),
    Course.countDocuments({ archivedAt: null }),
    Course.aggregate([
      { $match: { archivedAt: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]) as Promise<{ _id: string; count: number }[]>,
    User.find().sort({ createdAt: -1 }).limit(5).select("name email role createdAt").lean(),
    Course.find({ ownerId: adminId, archivedAt: null }).sort({ createdAt: -1 }).limit(8).select("title status chapterCount createdAt").lean(),
    CourseCategory.find().sort({ name: 1 }).select("name").lean(),
  ]);
  const courseNotice = (await searchParams).course;

  const statusCounts = new Map(courseStatuses.map(({ _id, count }) => [_id, count]));
  const readyCount = statusCounts.get("ready") ?? 0;
  const comingSoonCount = statusCounts.get("comingSoon") ?? 0;
  const processingCount = statusCounts.get("processing") ?? 0;
  const failedCount = statusCounts.get("failed") ?? 0;
  const metrics = [
    { label: "Registered users", value: userCount, note: `${newUserCount} joined in the last 7 days`, tone: "blue" },
    { label: "Administrators", value: adminCount, note: "Accounts with elevated access", tone: "slate" },
    { label: "Courses", value: courseCount, note: `${readyCount} ready to study`, tone: "green" },
    { label: "In progress", value: processingCount, note: `${failedCount} need attention`, tone: "amber" },
  ];
  const statusRows = [
    { label: "Ready", count: readyCount, color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Coming soon", count: comingSoonCount, color: "bg-cyan-500", text: "text-cyan-700" },
    { label: "Processing", count: processingCount, color: "bg-blue-600", text: "text-blue-700" },
    { label: "Failed", count: failedCount, color: "bg-rose-500", text: "text-rose-700" },
  ];

  return (
    <div className="space-y-9">
      <section aria-labelledby="upload-heading" className="min-w-0 space-y-6 sm:space-y-7">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">Course operations</p>
          <h2 id="upload-heading" className="mt-1 text-xl font-semibold text-slate-900">Create a course</h2>
        </div>
        {courseNotice === "category-invalid" && (
          <p role="alert" className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Choose an existing category before creating the course.
          </p>
        )}
        <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Create from a document or video lessons</h3>
            <UploadForm categories={categories.map((category) => ({ id: String(category._id), name: category.name }))} />
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">List it before materials are ready</h3>
            <ComingSoonCourseForm categories={categories.map((category) => ({ id: String(category._id), name: category.name }))} />
          </div>
        </div>
      </section>

      <section aria-label="Platform summary" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="min-w-0 border border-slate-200 bg-white p-4 sm:p-5">
            <p className="text-sm font-medium text-slate-600">{metric.label}</p>
            <p className="mt-3 break-words text-3xl font-semibold tabular-nums text-slate-950">{metric.value.toLocaleString()}</p>
            <p className={`mt-2 text-xs ${metric.tone === "green" ? "text-emerald-700" : metric.tone === "amber" ? "text-amber-700" : metric.tone === "blue" ? "text-blue-700" : "text-slate-500"}`}>
              {metric.note}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="managed-courses-heading">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div>
            <h2 id="managed-courses-heading" className="text-lg font-semibold text-slate-900">Courses you manage</h2>
            <p className="mt-1 text-sm text-slate-500">Edit course content, review student activity, or open a course.</p>
          </div>
          <Link href="/admin/courses" className="text-sm font-medium text-blue-700 hover:text-blue-900">
            Manage all courses
          </Link>
        </div>
        {managedCourses.length ? (
          <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {managedCourses.map((course) => (
              <li key={String(course._id)} className="grid min-w-0 gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900 [overflow-wrap:anywhere]">{course.title}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {course.chapterCount} modules <span aria-hidden="true">·</span> <span className="capitalize">{course.status}</span> <span aria-hidden="true">·</span> Updated {dateLabel(course.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
                  <Link href={`/courses/${course._id}`} className="text-blue-700 hover:text-blue-900">Open</Link>
                  {(course.status === "comingSoon" || course.status === "failed") && (
                    <Link href={`/admin/courses/${course._id}`} className="text-blue-700 hover:text-blue-900">Add materials</Link>
                  )}
                  {course.status === "ready" && (
                    <Link href={`/courses/${course._id}/edit`} className="text-blue-700 hover:text-blue-900">Edit</Link>
                  )}
                  <Link href={`/courses/${course._id}/students`} className="text-blue-700 hover:text-blue-900">Students</Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No courses yet. Upload a document above to get started.</p>
        )}
      </section>

      <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)] lg:gap-10">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent signups</h2>
              <p className="mt-1 text-sm text-slate-500">The newest accounts on your platform.</p>
            </div>
            <Link href="/admin/users" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              View all users <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
          {recentUsers.length ? (
            <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
              {recentUsers.map((user) => (
                <li key={String(user._id)} className="flex items-start justify-between gap-3 px-3 py-3.5 sm:items-center sm:gap-4 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center bg-blue-50 text-sm font-semibold text-blue-800">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                      <p className="break-all text-xs text-slate-600 sm:truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-medium ${user.role === "admin" ? "text-blue-700" : "text-slate-500"}`}>{user.role}</p>
                    <p className="mt-1 text-xs tabular-nums text-slate-500">{dateLabel(user.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No users have signed up yet.</p>
          )}
        </div>

        <div className="min-w-0 space-y-8 sm:space-y-9">
          <section aria-labelledby="course-status-heading">
            <div className="mb-4">
              <h2 id="course-status-heading" className="text-lg font-semibold text-slate-900">Course builds</h2>
              <p className="mt-1 text-sm text-slate-500">Current generation status across all courses.</p>
            </div>
            <div className="space-y-4 border-y border-slate-200 bg-white px-4 py-5">
              <div aria-hidden="true" className="flex h-2 overflow-hidden bg-slate-100">
                {courseCount > 0 && statusRows.map((status) => (
                  <span key={status.label} className={status.color} style={{ width: `${(status.count / courseCount) * 100}%` }} />
                ))}
              </div>
              {statusRows.map((status) => (
                <div key={status.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5 text-slate-600">
                    <span aria-hidden="true" className={`h-2 w-2 ${status.color}`} />
                    {status.label}
                  </span>
                  <span className={`font-semibold tabular-nums ${status.text}`}>{status.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </section>
    </div>
  );
}