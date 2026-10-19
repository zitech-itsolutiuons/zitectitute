import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { resetUserPasswordAction, updateCourseAccess, updatePlatformAccess } from "@/app/admin/users/actions";
import { connectDB } from "@/lib/db";
import { Course, CourseRestriction, StudentProgress } from "@/lib/models/Course";
import { CourseAccessGrant, CoursePayment } from "@/lib/models/CourseCommerce";
import { User } from "@/lib/models/User";
import { UserProfile } from "@/lib/models/UserProfile";
import { formatNaira } from "@/lib/currency";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  restricted: "Course access restricted for this user.",
  restored: "Course access restored for this user.",
  missing: "The selected user or course could not be found.",
  passwordUpdated: "Password changed. The user must sign in again on every device.",
  passwordInvalid: "Use a new password with at least 12 characters.",
  passwordMismatch: "The password fields do not match.",
  platformRestricted: "Platform access restricted for this learner.",
  platformRestored: "Platform access restored for this learner.",
  notLearner: "Platform restrictions can only be applied to learner accounts.",
};

export default async function UserCourseAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const [user, courses, restrictions, profile, progress, grants, payments] = await Promise.all([
    User.findById(id).select("name email role createdAt updatedAt failedLogins lockedUntil platformRestrictedAt").lean(),
    Course.find({ archivedAt: null }).sort({ title: 1 }).select("title status chapterCount").lean(),
    CourseRestriction.find({ userId: id }).select("courseId").lean(),
    UserProfile.findOne({ userId: id }).select("displayName studentId program level bio createdAt updatedAt").lean(),
    StudentProgress.find({ userId: id }).sort({ updatedAt: -1 }).select("courseId completedChapterIds quizAttempts assistantMessages enrolledAt updatedAt").lean(),
    CourseAccessGrant.find({ userId: id }).sort({ createdAt: -1 }).select("courseId source amountPaidKobo createdAt").lean(),
    CoursePayment.find({ userId: id }).sort({ createdAt: -1 }).limit(50).select("courseId amountKobo status createdAt").lean(),
  ]);
  if (!user) notFound();

  const restrictedIds = new Set(restrictions.map((restriction) => String(restriction.courseId)));
  const notice = notices[(await searchParams).notice ?? ""];
  const grantsByCourse = new Map(grants.map((grant) => [String(grant.courseId), grant]));
  const progressByCourse = new Map(progress.map((item) => [String(item.courseId), item]));

  return (
    <section aria-labelledby="course-access-heading">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm font-medium text-blue-700 hover:text-blue-900">
          Back to users
        </Link>
        <h2 id="course-access-heading" className="mt-4 text-xl font-semibold text-slate-900">Course access</h2>
        <p className="mt-1 text-sm text-slate-600">
          {user.name} <span className="text-slate-400">({user.email})</span>
        </p>
        <dl className="mt-4 grid gap-3 border-y border-slate-200 py-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt><dd className="mt-1 font-medium capitalize text-slate-900">{user.role}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Account created</dt><dd className="mt-1 text-slate-800">{user.createdAt.toLocaleString()}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Last account update</dt><dd className="mt-1 text-slate-800">{user.updatedAt.toLocaleString()}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Sign-in security</dt><dd className="mt-1 text-slate-800">{user.lockedUntil && user.lockedUntil > new Date() ? `Locked until ${user.lockedUntil.toLocaleString()}` : `${user.failedLogins} recent failed attempts`}</dd></div>
        </dl>
        <div className="mt-4 border-b border-slate-200 pb-5">
          <h3 className="font-semibold text-slate-900">Learner profile</h3>
          {profile ? (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Display name</dt><dd className="mt-1 text-slate-800">{profile.displayName}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Student ID</dt><dd className="mt-1 text-slate-800">{profile.studentId || "Not provided"}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Program</dt><dd className="mt-1 text-slate-800">{profile.program || "Not provided"}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Level</dt><dd className="mt-1 text-slate-800">{profile.level || "Not provided"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Bio</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{profile.bio || "Not provided"}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Profile last updated</dt><dd className="mt-1 text-slate-800">{profile.updatedAt.toLocaleString()}</dd></div>
            </dl>
          ) : <p className="mt-2 text-sm text-slate-500">This user has not completed a learner profile.</p>}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Restricting access immediately blocks course pages and learning APIs, even after payment. Their purchases and progress remain recorded.
        </p>
      </div>

      {notice && <p role="status" className="mb-5 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</p>}

      <section aria-labelledby="platform-access-heading" className="mb-10 max-w-2xl border-y border-slate-200 py-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 id="platform-access-heading" className="text-base font-semibold text-slate-900">Platform access</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {user.role !== "user"
                ? "Platform-wide restrictions are available for learner accounts only."
                : user.platformRestrictedAt
                  ? `Restricted since ${user.platformRestrictedAt.toLocaleString()}. Course and learning access is blocked until restored.`
                  : "This learner can access the platform and their available courses."}
            </p>
          </div>
          {user.role === "user" && (
            <form action={updatePlatformAccess} className="shrink-0">
              <input type="hidden" name="userId" value={id} />
              <input type="hidden" name="mode" value={user.platformRestrictedAt ? "restore" : "restrict"} />
              <button
                type="submit"
                className={user.platformRestrictedAt
                  ? "min-h-11 border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  : "min-h-11 border border-rose-700 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"}
              >
                {user.platformRestrictedAt ? "Restore platform access" : "Restrict platform access"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section aria-labelledby="password-reset-heading" className="mb-10 max-w-2xl border border-slate-200 bg-white p-5">
        <h3 id="password-reset-heading" className="text-base font-semibold text-slate-900">Change account password</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">Set a new password of at least 12 characters. This signs the user out on all devices. Share the new password with the user securely.</p>
        <form action={resetUserPasswordAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="userId" value={id} />
          <label className="block text-sm font-medium text-slate-700">
            New password
            <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 block min-h-11 w-full border border-slate-300 px-3 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirm new password
            <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 block min-h-11 w-full border border-slate-300 px-3 text-sm" />
          </label>
          <button type="submit" className="min-h-11 w-fit border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:col-span-2">
            Change password
          </button>
        </form>
      </section>

      <section aria-labelledby="purchases-heading" className="mb-10">
        <h3 id="purchases-heading" className="text-base font-semibold text-slate-900">Course purchases and access</h3>
        {grants.length ? (
          <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            {grants.map((grant) => {
              const courseId = String(grant.courseId);
              const course = courses.find((item) => String(item._id) === courseId);
              return (
                <li key={String(grant._id)} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{course?.title ?? "Course unavailable"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {grant.source === "paystack" ? "Paystack payment" : "100% promo code"}
                      {" · "}{formatNaira(grant.amountPaidKobo)}
                      {" · "}Unlocked {grant.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span className={restrictedIds.has(courseId) ? "text-xs font-semibold text-rose-700" : "text-xs font-semibold text-emerald-700"}>
                    {restrictedIds.has(courseId) ? "Restricted" : "Access active"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">No course purchases or promo grants.</p>}
      </section>

      <section aria-labelledby="payment-history-heading" className="mb-10">
        <h3 id="payment-history-heading" className="text-base font-semibold text-slate-900">Payment history</h3>
        {payments.length ? (
          <div className="mt-3 overflow-x-auto border-y border-slate-200">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
                <tr><th scope="col" className="px-3 py-2">Course</th><th scope="col" className="px-3 py-2">Amount</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={String(payment._id)}>
                    <td className="px-3 py-3">{courses.find((course) => String(course._id) === String(payment.courseId))?.title ?? "Course unavailable"}</td>
                    <td className="px-3 py-3 tabular-nums">{formatNaira(payment.amountKobo)}</td>
                    <td className="px-3 py-3 capitalize">{payment.status}</td>
                    <td className="px-3 py-3 text-slate-500">{payment.createdAt.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-2 text-sm text-slate-500">No payment attempts recorded.</p>}
      </section>

      <section aria-labelledby="learning-activity-heading" className="mb-10">
        <h3 id="learning-activity-heading" className="text-base font-semibold text-slate-900">Learning activity</h3>
        {progress.length ? (
          <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            {progress.map((item) => {
              const courseId = String(item.courseId);
              const course = courses.find((entry) => String(entry._id) === courseId);
              return (
                <li key={courseId} className="py-3">
                  <p className="font-medium text-slate-900">{course?.title ?? "Course unavailable"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.completedChapterIds.length} modules completed · {item.quizAttempts.length} quiz attempts · {item.assistantMessages} assistant questions
                    {" · "}Last active {item.updatedAt.toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">No learning activity recorded.</p>}
      </section>

      {courses.length === 0 ? (
        <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No courses have been created yet.</p>
      ) : (
        <div className="overflow-x-auto border-y border-slate-200 bg-white">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Course</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Access</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => {
                const courseId = String(course._id);
                const restricted = restrictedIds.has(courseId);
                return (
                  <tr key={courseId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{course.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{course.chapterCount} modules</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{course.status}</td>
                    <td className="px-4 py-3">
                      <span className={restricted ? "font-medium text-rose-700" : grantsByCourse.has(courseId) ? "font-medium text-emerald-700" : "text-slate-600"}>
                        {restricted
                          ? "Restricted"
                          : grantsByCourse.get(courseId)
                            ? `Unlocked · ${grantsByCourse.get(courseId)?.source === "paystack" ? "Paid" : "Promo"}`
                            : progressByCourse.has(courseId) ? "Invitation only" : "No access"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={updateCourseAccess}>
                        <input type="hidden" name="userId" value={id} />
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="mode" value={restricted ? "restore" : "restrict"} />
                        <button
                          type="submit"
                          className={`whitespace-nowrap border px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${restricted ? "border-blue-200 text-blue-800 hover:bg-blue-50" : "border-rose-200 text-rose-700 hover:bg-rose-50"}`}
                        >
                          {restricted ? "Restore access" : "Restrict access"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}