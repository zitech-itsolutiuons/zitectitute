import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId, Types } from "mongoose";
import { addCohortMemberAction, deleteCohortAction, removeCohortMemberAction, updateCohortAction } from "../actions";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import { CohortActivity } from "@/lib/models/CohortActivity";
import { CohortActivitySession } from "@/lib/models/CohortActivitySession";
import { Course } from "@/lib/models/Course";
import { User } from "@/lib/models/User";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  "member-added": "Learner added to the cohort.",
  "member-removed": "Learner removed from the cohort.",
  updated: "Cohort details updated.",
  course: "Choose only active courses.",
  invalid: "Choose a valid learner.",
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(date: Date | null | undefined) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Never";
}

const activityNames: Record<string, string> = {
  "signed-in": "Signed in",
  "signed-out": "Signed out",
  "course-opened": "Opened course",
  "lesson-opened": "Opened lesson",
  "quiz-submitted": "Submitted a module quiz",
  "final-assessment-submitted": "Submitted a final assessment",
  "discussion-started": "Started a cohort discussion",
  "discussion-replied": "Replied to a cohort discussion",
};

export default async function CohortDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDB();
  const cohort = await Cohort.findById(id).lean();
  if (!cohort) notFound();
  const [members, candidates, courses] = await Promise.all([
    cohort.memberUserIds.length
      ? User.find({ _id: { $in: cohort.memberUserIds } }).sort({ name: 1 }).select("name email").lean()
      : [],
    User.find({ role: "user", _id: { $nin: cohort.memberUserIds } }).sort({ name: 1 }).select("name email").lean(),
    Course.find({
      $or: [{ archivedAt: null }, ...(cohort.courseIds.length ? [{ _id: { $in: cohort.courseIds } }] : [])],
    }).sort({ title: 1 }).select("title archivedAt").lean(),
  ]);
  const retentionStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const activeCutoff = new Date(Date.now() - 2 * 60 * 1000);
  const [activitySummary, activityEvents] = await Promise.all([
    CohortActivitySession.aggregate<{
      _id: string;
      totalActiveSeconds: number;
      lastSignIn: Date;
      lastSeenAt: Date;
      activeNow: number;
    }>([
      { $match: { cohortIds: new Types.ObjectId(id), startedAt: { $gte: retentionStart } } },
      {
        $group: {
          _id: "$userId",
          totalActiveSeconds: { $sum: "$activeSeconds" },
          lastSignIn: { $max: "$startedAt" },
          lastSeenAt: { $max: "$lastSeenAt" },
          activeNow: {
            $max: {
              $cond: [
                { $and: [{ $eq: ["$endedAt", null] }, { $gte: ["$lastSeenAt", activeCutoff] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastSignIn: -1 } },
      { $limit: 500 },
    ]),
    CohortActivity.find({ cohortIds: id }).sort({ createdAt: -1 }).limit(150).lean(),
  ]);
  const activityUserIds = [...new Set([
    ...activitySummary.map((entry) => entry._id),
    ...activityEvents.map((event) => event.userId),
  ])];
  const activityUsers = activityUserIds.length
    ? await User.find({ _id: { $in: activityUserIds } }).select("name email").lean()
    : [];
  const activityUserNames = new Map(activityUsers.map((user) => [String(user._id), user.name]));
  const summaryByUser = new Map(activitySummary.map((entry) => [entry._id, entry]));
  const notice = notices[(await searchParams).notice ?? ""];
  return (
    <section aria-labelledby="cohort-heading" className="space-y-7">
      <Link href="/admin/cohorts" className="text-sm font-medium text-blue-700 hover:text-blue-900">Back to cohorts</Link>
      <header className="border-b border-slate-200 pb-5">
        <h2 id="cohort-heading" className="text-xl font-semibold text-slate-950">{cohort.name}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{cohort.description || "No description."}</p>
      </header>
      {notice && <p role="status" className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</p>}
      <form action={updateCohortAction} className="max-w-2xl space-y-4 border border-slate-200 bg-white p-5">
        <input type="hidden" name="cohortId" value={id} />
        <label className="block text-sm font-medium text-slate-700">Cohort name<input name="name" required maxLength={100} defaultValue={cohort.name} className="mt-1 block min-h-11 w-full border border-slate-300 px-3" /></label>
        <label className="block text-sm font-medium text-slate-700">Description<textarea name="description" maxLength={500} rows={3} defaultValue={cohort.description} className="mt-1 block w-full border border-slate-300 px-3 py-2" /></label>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Associated courses</legend>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto border border-slate-200 p-3">
            {courses.length ? courses.map((course) => (
              <label key={String(course._id)} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="courseIds" value={String(course._id)} defaultChecked={cohort.courseIds.some((courseId) => String(courseId) === String(course._id))} />
                {course.title}{course.archivedAt ? " (Archived)" : ""}
              </label>
            )) : <p className="text-sm text-slate-500">No active courses available.</p>}
          </div>
        </fieldset>
        <button type="submit" className="min-h-11 border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Save cohort</button>
      </form>
      <form action={addCohortMemberAction} className="flex max-w-2xl flex-wrap items-end gap-3">
        <input type="hidden" name="cohortId" value={id} />
        <label className="min-w-64 flex-1 text-sm font-medium text-slate-700">
          Add learner
          <select name="userId" required defaultValue="" className="mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 text-sm">
            <option value="" disabled>Select a learner</option>
            {candidates.map((user) => <option key={String(user._id)} value={String(user._id)}>{user.name} · {user.email}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!candidates.length} className="min-h-11 border border-blue-700 bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Add learner</button>
      </form>
      <section aria-labelledby="roster-heading">
        <h3 id="roster-heading" className="mb-3 text-lg font-semibold text-slate-900">Roster ({members.length})</h3>
        {members.length ? (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {members.map((user) => (
              <li key={String(user._id)} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium text-slate-900">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div>
                <form action={removeCohortMemberAction}>
                  <input type="hidden" name="cohortId" value={id} />
                  <input type="hidden" name="userId" value={String(user._id)} />
                  <button type="submit" className="min-h-10 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50">Remove from cohort</button>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className="border-y border-slate-200 py-6 text-sm text-slate-500">No learners in this cohort yet.</p>}
      </section>
      <section aria-labelledby="monitoring-heading" className="space-y-5 border-y border-slate-200 py-6">
        <header>
          <h3 id="monitoring-heading" className="text-lg font-semibold text-slate-900">Cohort activity</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Sign-ins, estimated active time, and learning actions from the last 90 days. Active time counts visible sessions with recent interaction and pauses after five idle minutes. Learners are informed about this monitoring; answers and discussion contents are not recorded here.
          </p>
        </header>
        {members.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-3">Learner</th>
                  <th scope="col" className="px-3 py-3">Last sign-in</th>
                  <th scope="col" className="px-3 py-3">Active time · 90 days</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((user) => {
                  const summary = summaryByUser.get(String(user._id));
                  return (
                    <tr key={String(user._id)} className="align-top">
                      <th scope="row" className="px-3 py-3 font-medium text-slate-900">
                        {user.name}<span className="mt-0.5 block font-normal text-slate-500">{user.email}</span>
                      </th>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{formatDate(summary?.lastSignIn)}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{formatDuration(summary?.totalActiveSeconds ?? 0)}</td>
                      <td className="px-3 py-3">
                        {summary?.activeNow
                          ? <span className="font-medium text-emerald-800">Active now</span>
                          : summary
                            ? <span className="text-slate-600">Last active {formatDate(summary.lastSeenAt)}</span>
                            : <span className="text-slate-500">No recorded sign-in</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-y border-slate-200 py-5 text-sm text-slate-500">Add learners to this cohort to see their activity here.</p>
        )}
        <div>
          <h4 className="mb-3 font-semibold text-slate-900">Recent learning activity</h4>
          {activityEvents.length ? (
            <ol className="divide-y divide-slate-200 border-y border-slate-200">
              {activityEvents.map((event) => (
                <li key={String(event._id)} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <p className="min-w-0 text-sm text-slate-800">
                    <span className="font-semibold">{activityUserNames.get(event.userId) ?? "Learner"}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    {event.label || activityNames[event.type] || "Learning activity"}
                  </p>
                  <time dateTime={event.createdAt.toISOString()} className="shrink-0 text-xs tabular-nums text-slate-500">
                    {formatDate(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-y border-slate-200 py-5 text-sm text-slate-500">No cohort activity recorded in the last 90 days.</p>
          )}
        </div>
      </section>
      <form action={deleteCohortAction}>
        <input type="hidden" name="cohortId" value={id} />
        <button type="submit" className="min-h-10 border border-rose-300 px-4 text-sm font-medium text-rose-800 hover:bg-rose-50">Delete cohort</button>
      </form>
    </section>
  );
}
