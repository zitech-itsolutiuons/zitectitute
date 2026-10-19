import { connectDB } from "@/lib/db";
import { Course, CourseGroup, CourseGroupSettings } from "@/lib/models/Course";
import GroupCodeInput from "@/components/admin/GroupCodeInput";
import { createCourseGroup, setCourseGroupCodesEnabled, setCourseGroupEnabled } from "./actions";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  enabled: "Course group codes are now enabled.",
  disabled: "Course group codes are now disabled. Existing course invitations remain on users’ course lists.",
  created: "Course group created. Share its code with users.",
  groupEnabled: "Course group code enabled.",
  groupDisabled: "Course group code disabled.",
  invalid: "Enter a group name and choose at least one course.",
  unavailable: "One or more selected courses are no longer ready to share.",
  missing: "That course group could not be found.",
};

export default async function AdminGroupsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connectDB();
  const [settings, courses, groups] = await Promise.all([
    CourseGroupSettings.findOne({ key: "course-groups" }).select("enabled").lean(),
    Course.find({ status: "ready", archivedAt: null }).sort({ title: 1 }).select("title").lean(),
    CourseGroup.find().sort({ createdAt: -1 }).lean(),
  ]);
  const groupCourseIds = [...new Set(groups.flatMap((group) => group.courseIds.map(String)))];
  const groupCourses = groupCourseIds.length
    ? await Course.find({ _id: { $in: groupCourseIds } }).select("title").lean()
    : [];
  const courseTitles = new Map(groupCourses.map((course) => [String(course._id), course.title]));
  const featureEnabled = !!settings?.enabled;
  const notice = notices[(await searchParams).notice ?? ""];

  return (
    <div className="space-y-10">
      <section aria-labelledby="group-codes-heading">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <h2 id="group-codes-heading" className="text-xl font-semibold text-slate-950">Course group codes</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create one code that adds several course invitations to a learner’s list. Lessons still require payment or a valid 100% promo code.
            </p>
          </div>
          <form action={setCourseGroupCodesEnabled}>
            <input type="hidden" name="enabled" value={String(!featureEnabled)} />
            <button
              type="submit"
              aria-pressed={featureEnabled}
              className={`min-h-10 border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${featureEnabled ? "border-rose-200 text-rose-800 hover:bg-rose-50" : "border-blue-700 bg-blue-700 text-white hover:bg-blue-800"}`}
            >
              {featureEnabled ? "Turn off group codes" : "Turn on group codes"}
            </button>
          </form>
        </div>
        <p className={`mt-4 text-sm font-medium ${featureEnabled ? "text-emerald-700" : "text-slate-500"}`}>
          Group code feature: {featureEnabled ? "On" : "Off"}
        </p>
      </section>

      {notice && <p role="status" className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</p>}

      <section aria-labelledby="create-group-heading" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h3 id="create-group-heading" className="text-lg font-semibold text-slate-900">Create a course group</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choose the courses this code should include. Users can purchase each course separately after joining.</p>
        </div>
        <form action={createCourseGroup} className="space-y-5 border border-slate-200 bg-white p-5">
          <label className="block text-sm font-medium text-slate-700">
            Group name
            <input name="name" required maxLength={100} className="mt-2 block min-h-11 w-full border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Courses</legend>
            {courses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No ready courses are available to add.</p>
            ) : (
              <div className="mt-3 max-h-64 space-y-1 overflow-y-auto border border-slate-200 p-2">
                {courses.map((course) => (
                  <label key={String(course._id)} className="flex min-h-10 items-center gap-3 px-2 text-sm text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" name="courseIds" value={String(course._id)} className="h-4 w-4 accent-blue-700" />
                    <span>{course.title}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <button
            type="submit"
            disabled={courses.length === 0}
            className="min-h-10 border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Create group code
          </button>
        </form>
      </section>

      <section aria-labelledby="existing-groups-heading">
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h3 id="existing-groups-heading" className="text-lg font-semibold text-slate-900">Existing groups</h3>
            <p className="mt-1 text-sm text-slate-600">Disabling a code stops new invitations. Existing purchases stay active.</p>
          </div>
          <span className="text-sm tabular-nums text-slate-500">{groups.length} total</span>
        </div>
        {groups.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No course groups yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {groups.map((group) => (
              <li key={String(group._id)} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="font-semibold text-slate-900">{group.name}</h4>
                    <span className={`text-xs font-medium ${group.enabled ? "text-emerald-700" : "text-slate-500"}`}>{group.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <label className="mt-3 block max-w-xl text-xs font-medium text-slate-600">
                    Group code
                    <GroupCodeInput code={group.code} />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {group.courseIds.map((courseId) => courseTitles.get(String(courseId)) ?? "Course unavailable").join(", ")}
                  </p>
                </div>
                <form action={setCourseGroupEnabled}>
                  <input type="hidden" name="groupId" value={String(group._id)} />
                  <input type="hidden" name="enabled" value={String(!group.enabled)} />
                  <button type="submit" className="min-h-10 border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    {group.enabled ? "Disable code" : "Enable code"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}