import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LearnerWorkspaceLayout from "@/components/LearnerWorkspaceLayout";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";

export const dynamic = "force-dynamic";

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  await connectDB();
  const cohorts = await Cohort.find({ memberUserIds: session.user.id })
    .sort({ name: 1 })
    .select("name description courseIds")
    .lean();
  const notice = (await searchParams).notice;

  return (
    <LearnerWorkspaceLayout>
      <main className="w-full">
        <div className="space-y-8">
          <header className="border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
            <h1 className="font-serif text-3xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Your cohorts</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
              Find your cohort courses and continue the conversation with your group.
            </p>
          </header>
          {notice === "unavailable" && (
            <p role="alert" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              That cohort is no longer available to your account.
            </p>
          )}
          {cohorts.length ? (
            <ul className="divide-y divide-[#d9d5ca] border-y border-[#d9d5ca] dark:divide-[#394941] dark:border-[#394941]">
              {cohorts.map((cohort) => (
                <li key={String(cohort._id)} className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">{cohort.name}</h2>
                    {cohort.description && (
                      <p className="mt-1 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">{cohort.description}</p>
                    )}
                    <p className="mt-2 text-xs font-medium text-[#59685e] dark:text-[#c0c8bf]">
                      {cohort.courseIds.length} {cohort.courseIds.length === 1 ? "course" : "courses"}
                    </p>
                  </div>
                  <Link
                    href={`/cohorts/${cohort._id}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center border border-[#355f4c] px-4 text-sm font-semibold text-[#355f4c] transition-colors hover:bg-[#e9eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#9abd9f] dark:text-[#c0d4c1] dark:hover:bg-[#2b3a32] dark:focus-visible:outline-[#d7bd7a]"
                  >
                    Open cohort
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <section className="border-y border-[#d9d5ca] py-8 dark:border-[#394941]">
              <h2 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">No cohorts yet</h2>
              <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                When an administrator adds you to a cohort, its courses and group discussion will appear here.
              </p>
              <Link href="/courses" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-[#355f4c] underline underline-offset-4 hover:text-[#263b30] dark:text-[#b5c9b5] dark:hover:text-white">
                Back to your learning
              </Link>
            </section>
          )}
        </div>
      </main>
    </LearnerWorkspaceLayout>
  );
}
