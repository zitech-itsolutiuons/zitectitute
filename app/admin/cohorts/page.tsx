import Link from "next/link";
import { createCohortAction } from "./actions";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import { Course } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  created: "Cohort created.",
  deleted: "Cohort deleted. Student accounts and course progress were not affected.",
  invalid: "Enter a valid cohort name, description, and course selection.",
  course: "One or more selected courses are unavailable.",
  missing: "The selected cohort could not be found.",
};

export default async function AdminCohortsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connectDB();
  const [cohorts, courses] = await Promise.all([
    Cohort.find().sort({ createdAt: -1 }).lean(),
    Course.find({ archivedAt: null }).sort({ title: 1 }).select("title").lean(),
  ]);
  const notice = notices[(await searchParams).notice ?? ""];
  return (
    <section aria-labelledby="cohorts-heading" className="space-y-8">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="cohorts-heading" className="text-xl font-semibold text-slate-950">Student cohorts</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Organize learner rosters independently from course invite groups. Assign courses to a cohort and use its roster to filter reports.</p>
      </header>
      {notice && <p role="status" className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</p>}
      <form action={createCohortAction} className="max-w-3xl space-y-5 border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Create a cohort</h3>
        <label className="block text-sm font-medium text-slate-700">
          Cohort name
          <input name="name" required maxLength={100} className="mt-2 block min-h-11 w-full border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-500">(optional)</span>
          <textarea name="description" maxLength={500} rows={2} className="mt-2 block w-full border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Associated courses <span className="font-normal text-slate-500">(optional)</span></legend>
          {courses.length ? (
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto border border-slate-200 p-2">
              {courses.map((course) => (
                <label key={String(course._id)} className="flex min-h-10 items-center gap-3 px-2 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" name="courseIds" value={String(course._id)} className="h-4 w-4 accent-blue-700" />
                  {course.title}
                </label>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-slate-500">No active courses.</p>}
        </fieldset>
        <button type="submit" className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800">Create cohort</button>
      </form>
      <section aria-labelledby="cohorts-list-heading">
        <div className="mb-3 flex items-end justify-between border-b border-slate-200 pb-3">
          <h3 id="cohorts-list-heading" className="text-lg font-semibold text-slate-900">Existing cohorts</h3>
          <span className="text-sm tabular-nums text-slate-500">{cohorts.length} total</span>
        </div>
        {cohorts.length ? (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {cohorts.map((cohort) => (
              <li key={String(cohort._id)} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <h4 className="font-medium text-slate-900">{cohort.name}</h4>
                  <p className="mt-1 text-sm text-slate-500">{cohort.memberUserIds.length} learners · {cohort.courseIds.length} courses</p>
                </div>
                <Link href={`/admin/cohorts/${cohort._id}`} className="inline-flex min-h-10 items-center border border-blue-700 px-4 text-sm font-medium text-blue-800 hover:bg-blue-50">Manage roster</Link>
              </li>
            ))}
          </ul>
        ) : <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No cohorts created yet.</p>}
      </section>
    </section>
  );
}
