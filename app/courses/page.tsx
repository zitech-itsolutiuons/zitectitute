import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LearnerWorkspaceLayout from "@/components/LearnerWorkspaceLayout";
import UploadForm from "@/components/UploadForm";
import CourseDashboardTabs from "@/components/CourseDashboardTabs";
import { joinCourseByCode } from "@/app/courses/actions";
import { connectDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { Course, CourseGroupSettings, CourseRestriction, StudentProgress } from "@/lib/models/Course";
import { CourseAccessGrant } from "@/lib/models/CourseCommerce";
import { Cohort } from "@/lib/models/Cohort";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { LoginStreak } from "@/lib/models/LoginStreak";
import { Certificate } from "@/lib/models/LearningFeatures";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { UserProfile } from "@/lib/models/UserProfile";
import LoginStreakCard from "@/components/LoginStreakCard";
import AchievementBadges from "@/components/AchievementBadges";
import { getAchievementBadgeMetrics } from "@/lib/achievementBadges";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; description?: string | null; note: string; action?: string; href?: string; priceKobo: number | null; completed?: number; total?: number; roleLabel?: string };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.platformRestricted) {
    return (
      <LearnerWorkspaceLayout>
        <main aria-label="Learning dashboard" className="min-h-[60vh] w-full">
          <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">My learning</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Your courses, cohort activity, and learning progress.</p>
          </header>
          <div className="mt-8 max-w-3xl space-y-5" aria-hidden="true">
            <div className="h-4 w-2/5 bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-3/5 bg-slate-100 dark:bg-slate-800" />
            <div className="h-px bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-1/2 bg-slate-100 dark:bg-slate-800" />
          </div>
        </main>
      </LearnerWorkspaceLayout>
    );
  }
  const userId = session.user.id;
  await connectDB();
  const canUpload = await isAdmin(userId);
  const loginStreakKey = session.user.loginStreakKey
    ?? (isValidObjectId(userId) ? `credentials:${userId}` : null);

  const [restrictions, groupCodeSettings, profile, grants, cohortCourseIds, loginStreak, platformSettings] = await Promise.all([
    CourseRestriction.find({ userId }).select("courseId").lean(),
    CourseGroupSettings.findOne({ key: "course-groups" }).select("enabled").lean(),
    UserProfile.findOne({ userId }).select("displayName avatarData").lean(),
    CourseAccessGrant.find({ userId }).select("courseId").lean(),
    Cohort.distinct("courseIds", { memberUserIds: userId }),
    session.user.role !== "admin" && loginStreakKey
      ? LoginStreak.findOne({ accountKey: loginStreakKey }).select("currentStreak longestStreak lastLoginDay recentLoginDays").lean()
      : Promise.resolve(null),
    PlatformSettings.findOne({ key: "platform" }).select("achievementBadgesEnabled").lean(),
  ]);
  const achievementBadgesEnabled = platformSettings?.achievementBadgesEnabled === true;
  const categories = canUpload
    ? await CourseCategory.find().sort({ name: 1 }).select("name").lean()
    : [];
  const groupCodesEnabled = !!groupCodeSettings?.enabled;
  const displayName = profile?.displayName || session.user.name || "there";
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  const restrictedIds = restrictions.map((restriction) => restriction.courseId);
  const grantedIds = grants.map((grant) => grant.courseId);
  const cohortIds = new Set(cohortCourseIds.map(String));
  const invitations = await StudentProgress.find({ userId, courseId: { $nin: restrictedIds } }).select("courseId completedChapterIds").lean();
  let badgeMetrics = null;
  if (achievementBadgesEnabled && session.user.role !== "admin") {
    const [progressRecords, completedCourseCount] = await Promise.all([
      StudentProgress.find({ userId }).select("completedChapterIds").lean(),
      Certificate.countDocuments({ userId }),
    ]);
    badgeMetrics = getAchievementBadgeMetrics({
      longestStreak: loginStreak?.longestStreak ?? 0,
      completedModules: progressRecords.reduce((total, progress) => total + progress.completedChapterIds.length, 0),
      completedCourses: completedCourseCount,
    });
  }
  const invitedIds = [...new Set(invitations.map((invitation) => String(invitation.courseId)))];
  const invitedObjectIds = invitations.map((invitation) => invitation.courseId);
  const [ownedCourses, assignedCourses, grantedCourses, catalogCourses, invitedCourses] = await Promise.all([
    Course.find({ ownerId: userId, archivedAt: null, _id: { $nin: restrictedIds } }).sort({ createdAt: -1 }).select("title description status chapterCount priceKobo").lean(),
    session.user.role === "instructor"
      ? Course.find({ instructorId: userId, archivedAt: null, _id: { $nin: restrictedIds } }).sort({ title: 1 }).select("title description status chapterCount priceKobo").lean()
      : [],
    grantedIds.length
      ? Course.find({ _id: { $in: grantedIds, $nin: restrictedIds }, ownerId: { $ne: userId }, archivedAt: null }).sort({ title: 1 }).select("title description status chapterCount priceKobo").lean()
      : [],
    Course.find({ catalogVisible: true, archivedAt: null, _id: { $nin: restrictedIds } }).sort({ createdAt: -1 }).select("title description status chapterCount priceKobo").lean(),
    invitedObjectIds.length
      ? Course.find({ _id: { $in: invitedObjectIds, $nin: restrictedIds }, ownerId: { $ne: userId }, status: "ready", archivedAt: null }).sort({ title: 1 }).select("title description status chapterCount priceKobo").lean()
      : [],
  ]);
  const unlockedIds = new Set(grants.map((grant) => String(grant.courseId)));
  const invitationIds = new Set(invitedIds);
  const progressByCourse = new Map(invitations.map((progress) => [String(progress.courseId), progress.completedChapterIds.length]));

  const ownedRows: Row[] = ownedCourses.map((c) => ({
    id: String(c._id),
    title: c.title,
    description: c.description,
    note: c.status === "comingSoon" ? "Coming soon" : c.status === "ready" ? `${c.chapterCount} modules` : c.status === "processing" ? "Study materials are being prepared" : "Build failed. Add materials to try again.",
    action: c.status === "ready" ? "Open course" : "View course",
    priceKobo: typeof c.priceKobo === "number" ? c.priceKobo : null,
  }));
  const ownedIds = new Set(ownedCourses.map((course) => String(course._id)));
  const assignedIds = new Set(assignedCourses.map((course) => String(course._id)));
  const assignedRows: Row[] = assignedCourses
    .filter((course) => !ownedIds.has(String(course._id)))
    .map((course) => ({
      id: String(course._id),
      title: course.title,
      description: course.description,
      note: course.status === "ready" ? `${course.chapterCount} modules · Assigned to you` : "Assigned to you · Materials are not ready to edit yet",
      action: course.status === "ready" ? "Edit course" : "View course",
      href: course.status === "ready" ? `/courses/${course._id}/edit` : `/courses/${course._id}`,
      priceKobo: typeof course.priceKobo === "number" ? course.priceKobo : null,
      roleLabel: "Instructor",
    }));
  const grantedRows: Row[] = grantedCourses
    .filter((course) => !assignedIds.has(String(course._id)))
    .map((course) => {
      const completed = Math.min(progressByCourse.get(String(course._id)) ?? 0, course.chapterCount);
      return {
        id: String(course._id),
        title: course.title,
        description: course.description,
        note: course.status === "ready" ? `${course.chapterCount} modules · Access unlocked` : course.status === "processing" ? "Access unlocked · Study materials are being prepared" : course.status === "comingSoon" ? "Access unlocked · Coming soon" : "Access unlocked · Materials are being updated",
        action: course.status === "ready" ? "Continue" : "View course",
        priceKobo: typeof course.priceKobo === "number" ? course.priceKobo : null,
        href: `/courses/${course._id}`,
        completed,
        total: course.chapterCount,
      };
    });
  const listingsById = new Map(catalogCourses.map((course) => [String(course._id), course]));
  invitedCourses.forEach((course) => {
    const id = String(course._id);
    if (!listingsById.has(id)) listingsById.set(id, course);
  });
  const catalogRows: Row[] = [...listingsById.values()]
    .filter((course) => !ownedIds.has(String(course._id)) && !assignedIds.has(String(course._id)) && !unlockedIds.has(String(course._id)) && !cohortIds.has(String(course._id)))
    .map((course) => ({
      id: String(course._id),
      title: course.title,
      description: course.description,
      note: invitationIds.has(String(course._id))
        ? `${course.chapterCount} modules · Invitation received; purchase or use a valid promo code to unlock`
        : course.status === "ready" ? `${course.chapterCount} modules` : course.status === "processing" ? "Study materials are being prepared" : course.status === "failed" ? "Materials are being updated" : "Coming soon",
      action: "View details",
      href: `/courses/${course._id}/overview`,
      priceKobo: typeof course.priceKobo === "number" ? course.priceKobo : null,
    }));
  const joinNotice = (await searchParams).join;
  const myRows = [...ownedRows, ...assignedRows, ...grantedRows];

  return (
    <LearnerWorkspaceLayout>
      <main className="w-full">
        <div className="min-w-0 space-y-7 sm:space-y-10">
        <header className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:gap-5 sm:pb-6 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {profile?.avatarData ? (
              <img
                src={profile.avatarData}
                alt={`Profile photo of ${displayName}`}
                width={56}
                height={56}
                className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover sm:h-14 sm:w-14 dark:border-slate-700"
              />
            ) : (
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-800 sm:h-14 sm:w-14 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white">Your learning</h1>
              <p className="mt-1.5 text-sm leading-5 text-slate-600 [overflow-wrap:anywhere] sm:mt-2 dark:text-slate-300">Welcome back, {displayName}. Continue a course or find your next one.</p>
            </div>
          </div>
          <Link href="/profile" className="inline-flex min-h-11 items-center text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200">
            Edit profile
          </Link>
        </header>

        {session.user.role !== "admin" && (
          <LoginStreakCard
            currentStreak={loginStreak?.currentStreak ?? 0}
            longestStreak={loginStreak?.longestStreak ?? 0}
            lastLoginDay={loginStreak?.lastLoginDay ?? null}
            recentLoginDays={loginStreak?.recentLoginDays ?? []}
            today={new Date().toISOString().slice(0, 10)}
          />
        )}

        {badgeMetrics && <AchievementBadges metrics={badgeMetrics} />}

        {canUpload && (
          <section aria-labelledby="upload-heading" className="border-b border-slate-200 pb-8 dark:border-slate-800">
            <h2 id="upload-heading" className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Create a course</h2>
            <UploadForm categories={categories.map((category) => ({ id: String(category._id), name: category.name }))} />
          </section>
        )}

        <div className="grid min-w-0 grid-cols-1 items-start gap-7 sm:gap-10 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <CourseDashboardTabs myCourses={myRows} availableCourses={catalogRows} />

          <aside aria-labelledby="join-course-heading" className="join-course-panel min-w-0 p-4 sm:p-5">
            <h2 id="join-course-heading" className="text-base font-semibold text-slate-900 dark:text-white">Join with a code</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Enter a course code shared by your instructor{groupCodesEnabled ? " or a group code to join several courses at once" : ""}.
            </p>
            {joinNotice === "success" && (
              <p role="status" className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Course invitation added. Purchase the course or use a valid 100% promo code to unlock its lessons.</p>
            )}
            {joinNotice === "invalid" && (
              <p role="alert" className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">That code is invalid, disabled, or has no courses available to join.</p>
            )}
            <form action={joinCourseByCode} className="mt-4 min-w-0 space-y-3">
              <label htmlFor="course-code" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Course or group code
                <input
                  id="course-code"
                  name="code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                  required
                  className="mt-2 block min-h-11 w-full min-w-0 border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <button type="submit" className="min-h-11 w-full border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                Join course
              </button>
            </form>
          </aside>
        </div>

        </div>
      </main>
    </LearnerWorkspaceLayout>
  );
}
