import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import SessionActivityTracker from "@/components/SessionActivityTracker";
import ThemeControl from "@/components/ThemeControl";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Notification } from "@/lib/models/LearningFeatures";
import { endCohortActivitySessionAction } from "@/app/session-actions";

export default async function SiteHeader() {
  const session = await auth();
  const restricted = session?.user.platformRestricted === true;
  const admin = session?.user?.id && !restricted ? await isAdmin(session.user.id) : false;
  let displayName = session?.user?.name ?? session?.user?.email ?? "";
  let unreadCount = 0;
  if (session?.user?.id && !restricted) {
    await connectDB();
    const [profile, unread] = await Promise.all([
      UserProfile.findOne({ userId: session.user.id }).select("displayName").lean(),
      Notification.countDocuments({ userId: session.user.id, readAt: null }),
    ]);
    displayName = profile?.displayName || displayName;
    unreadCount = unread;
  }

  async function signOutCurrentUser() {
    "use server";
    try {
      await endCohortActivitySessionAction();
    } catch (error) {
      console.error("Could not close the cohort activity session during sign-out", error);
    }
    await signOut({ redirectTo: "/" });
  }

  return (
    <>
    {session?.user && !restricted && <SessionActivityTracker isAdmin={admin} />}
    <header className="site-header sticky top-0 z-50 border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-10">
        <Link
          href="/"
          aria-label="Zitectitute"
          className="site-brand flex min-w-0 shrink items-center gap-2.5 text-base font-semibold leading-tight tracking-[-0.02em] sm:text-lg"
        >
          <span aria-hidden="true" className="site-brand__mark shrink-0 font-sans text-[0.68rem] font-bold tracking-[-0.04em]">ZT</span>
          <span className="max-w-[14ch] text-sm sm:max-w-none sm:text-lg">Zitectitute</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center text-sm">
          <div className="hidden items-center gap-5 sm:flex">
            <ThemeControl />
            {session?.user ? (
              <>
              <Link href="/courses" className="site-nav-link">
                Learn
              </Link>
              <Link href="/profile" className="site-nav-link">
                Profile
              </Link>
              <NotificationBell initialUnreadCount={unreadCount} />
              <Link href="/certificates" className="site-nav-link">
                Certificates
              </Link>
              {admin && (
                <Link href="/admin" className="site-nav-link">
                  Admin
                </Link>
              )}
              <span className="hidden max-w-[16ch] truncate border-l border-slate-200 pl-4 text-slate-500 sm:inline">
                {displayName}
              </span>
              <form action={signOutCurrentUser}>
                <button type="submit" className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Sign out
                </button>
              </form>
              </>
            ) : (
              <Link href="/signin" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Sign in
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <ThemeControl />
            <details className="relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Menu
              </summary>
              <div className="absolute right-0 top-full z-[60] mt-2 grid w-56 gap-1 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {session?.user ? (
                  <>
                    <Link href="/profile" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Profile</Link>
                    <Link href="/courses" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Your courses</Link>
                    <Link href="/notifications" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Notifications{unreadCount > 0 ? ` (${unreadCount > 99 ? "99+" : unreadCount})` : ""}</Link>
                    <Link href="/certificates" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Certificates</Link>
                    {admin && <Link href="/admin" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Admin</Link>}
                    <form action={signOutCurrentUser}>
                      <button type="submit" className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Sign out</button>
                    </form>
                  </>
                ) : (
                  <Link href="/signin" className="px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Sign in</Link>
                )}
              </div>
            </details>
          </div>
        </nav>
      </div>
    </header>
    </>
  );
}
