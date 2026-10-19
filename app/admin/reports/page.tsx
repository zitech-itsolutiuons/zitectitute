import { formatNaira } from "@/lib/currency";
import { loadActivityReport, loadPaymentReport, type AdminReportFilters } from "@/lib/adminReports";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import { Course } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

function parseDay(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; courseId?: string; cohortId?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  const selectedTo = parseDay(params.to, new Date(defaultTo.getTime() - 24 * 60 * 60 * 1000));
  const to = new Date(selectedTo.getTime() + 24 * 60 * 60 * 1000);
  const from = parseDay(params.from, new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000));
  const filters: AdminReportFilters = {
    from,
    to,
    ...(params.courseId && /^[a-f\d]{24}$/i.test(params.courseId) ? { courseId: params.courseId } : {}),
    ...(params.cohortId && /^[a-f\d]{24}$/i.test(params.cohortId) ? { cohortId: params.cohortId } : {}),
  };
  await connectDB();
  const [payments, activities, courses, cohorts] = await Promise.all([
    loadPaymentReport(filters),
    loadActivityReport(filters),
    Course.find().sort({ title: 1 }).select("title").lean(),
    Cohort.find().sort({ name: 1 }).select("name").lean(),
  ]);
  const successful = payments.filter((payment) => payment.status === "success");
  const revenueKobo = successful.reduce((sum, payment) => sum + payment.amountKobo, 0);
  const averageCompletion = activities.length
    ? Math.round(activities.reduce((sum, activity) => sum + activity.completionPercent, 0) / activities.length)
    : 0;
  const query = new URLSearchParams({
    from: filters.from.toISOString().slice(0, 10),
    to: new Date(filters.to.getTime() - 1).toISOString().slice(0, 10),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.cohortId ? { cohortId: filters.cohortId } : {}),
  });
  const paymentHref = `/api/admin/reports/payments?${query}`;
  const activityHref = `/api/admin/reports/activity?${query}`;
  return (
    <section aria-labelledby="reports-heading" className="space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="reports-heading" className="text-xl font-semibold text-slate-950">Payments, revenue and learner activity</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Revenue includes successful Paystack transactions only. Attendance is inferred from the learner’s latest recorded course activity; completion shows the current snapshot for active learners in the selected period.</p>
      </header>
      <form className="grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">From<input type="date" name="from" defaultValue={filters.from.toISOString().slice(0, 10)} className="mt-1 block min-h-10 w-full border border-slate-300 px-2" /></label>
        <label className="text-sm font-medium text-slate-700">To<input type="date" name="to" defaultValue={new Date(filters.to.getTime() - 1).toISOString().slice(0, 10)} className="mt-1 block min-h-10 w-full border border-slate-300 px-2" /></label>
        <label className="text-sm font-medium text-slate-700">Course<select name="courseId" defaultValue={filters.courseId ?? ""} className="mt-1 block min-h-10 w-full border border-slate-300 bg-white px-2"><option value="">All courses</option>{courses.map((course) => <option key={String(course._id)} value={String(course._id)}>{course.title}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Cohort<select name="cohortId" defaultValue={filters.cohortId ?? ""} className="mt-1 block min-h-10 w-full border border-slate-300 bg-white px-2"><option value="">All learners</option>{cohorts.map((cohort) => <option key={String(cohort._id)} value={String(cohort._id)}>{cohort.name}</option>)}</select></label>
        <button type="submit" className="min-h-10 self-end border border-blue-700 bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">Apply filters</button>
      </form>
      <div className="grid gap-px border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-4"><p className="text-xs text-slate-500">Successful revenue</p><p className="mt-1 text-xl font-semibold text-slate-900">{formatNaira(revenueKobo)}</p></div>
        <div className="bg-white p-4"><p className="text-xs text-slate-500">Transactions</p><p className="mt-1 text-xl font-semibold text-slate-900">{successful.length} successful · {payments.length - successful.length} other</p></div>
        <div className="bg-white p-4"><p className="text-xs text-slate-500">Active learner/course records</p><p className="mt-1 text-xl font-semibold text-slate-900">{activities.length}</p></div>
        <div className="bg-white p-4"><p className="text-xs text-slate-500">Average completion</p><p className="mt-1 text-xl font-semibold text-slate-900">{averageCompletion}%</p></div>
      </div>
      <section aria-labelledby="payments-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 id="payments-heading" className="text-lg font-semibold text-slate-900">Payment transactions</h3><a href={paymentHref} className="text-sm font-medium text-blue-700 hover:text-blue-900">Download CSV</a></div>
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Course</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Reference</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {payments.slice(0, 250).map((payment) => <tr key={payment.reference}><td className="whitespace-nowrap px-3 py-3">{payment.date.toLocaleDateString()}</td><td className="px-3 py-3">{payment.student}<span className="block text-xs text-slate-500">{payment.email}</span></td><td className="px-3 py-3">{payment.course}</td><td className="px-3 py-3">{formatNaira(payment.amountKobo)}</td><td className="px-3 py-3 capitalize">{payment.status}</td><td className="px-3 py-3">{payment.source}</td><td className="px-3 py-3 font-mono text-xs">{payment.reference}</td></tr>)}
              {!payments.length && <tr><td colSpan={7} className="px-3 py-6 text-slate-500">No transactions in this period.</td></tr>}
            </tbody>
          </table>
          {payments.length > 250 && <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">Showing 250 of {payments.length} transactions. CSV exports are capped at 10,000 records; narrow the filters for larger datasets.</p>}
        </div>
      </section>
      <section aria-labelledby="activity-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 id="activity-heading" className="text-lg font-semibold text-slate-900">Attendance and completion</h3><p className="mt-1 text-sm text-slate-500">One row per learner and course with course activity recorded in the selected date range.</p></div><a href={activityHref} className="text-sm font-medium text-blue-700 hover:text-blue-900">Download CSV</a></div>
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Last active</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Student ID</th><th className="px-3 py-2">Course</th><th className="px-3 py-2">Completion</th><th className="px-3 py-2">Quiz attempts</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {activities.slice(0, 250).map((activity, index) => <tr key={`${activity.email}-${activity.course}-${index}`}><td className="whitespace-nowrap px-3 py-3">{activity.date.toLocaleString()}</td><td className="px-3 py-3">{activity.student}<span className="block text-xs text-slate-500">{activity.email}</span></td><td className="px-3 py-3">{activity.studentId || "—"}</td><td className="px-3 py-3">{activity.course}</td><td className="px-3 py-3">{activity.completed}/{activity.total} ({activity.completionPercent}%)</td><td className="px-3 py-3">{activity.quizAttempts}</td></tr>)}
              {!activities.length && <tr><td colSpan={6} className="px-3 py-6 text-slate-500">No learner activity in this period.</td></tr>}
            </tbody>
          </table>
          {activities.length > 250 && <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">Showing 250 of {activities.length} records. CSV exports are capped at 10,000 records; narrow the filters for larger datasets.</p>}
        </div>
      </section>
    </section>
  );
}
