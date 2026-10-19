import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import LearnerWorkspaceLayout from "@/components/LearnerWorkspaceLayout";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import { CohortDiscussion } from "@/lib/models/CohortDiscussion";
import { Course, CourseRestriction } from "@/lib/models/Course";
import { User } from "@/lib/models/User";
import { createCohortDiscussionAction, replyToCohortDiscussionAction } from "../actions";

export const dynamic = "force-dynamic";

const notices: Record<string, { message: string; isError: boolean }> = {
  "invalid-topic": { message: "Add a topic title and message within the stated length limits.", isError: true },
  "invalid-reply": { message: "Add a reply within the 3,000-character limit.", isError: true },
  "missing-thread": { message: "That discussion topic could not be found. Refresh the page and try again.", isError: true },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function CohortDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, auth()]);
  if (!session?.user) redirect("/signin");
  if (!isValidObjectId(id)) notFound();

  await connectDB();
  const cohort = await Cohort.findOne({ _id: id, memberUserIds: session.user.id }).lean();
  if (!cohort) notFound();

  const [courses, threads] = await Promise.all([
    Course.find({ _id: { $in: cohort.courseIds }, archivedAt: null })
      .sort({ title: 1 })
      .select("title description chapterCount status")
      .lean(),
    CohortDiscussion.find({ cohortId: id }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const restrictions = courses.length
    ? await CourseRestriction.find({ userId: session.user.id, courseId: { $in: courses.map((course) => course._id) } })
        .distinct("courseId")
    : [];
  const restrictedIds = new Set(restrictions.map(String));
  const availableCourses = courses.filter((course) => !restrictedIds.has(String(course._id)));
  const authorIds = [...new Set(threads.flatMap((thread) => [thread.authorId, ...thread.replies.map((reply) => reply.authorId)]))];
  const authors = authorIds.length
    ? await User.find({ _id: { $in: authorIds } }).select("name").lean()
    : [];
  const authorNames = new Map(authors.map((author) => [String(author._id), author.name]));
  const notice = query.notice ? notices[query.notice] : undefined;

  return (
    <LearnerWorkspaceLayout>
      <main className="w-full">
        <div className="space-y-9">
          <header className="border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
            <Link href="/cohorts" className="text-sm font-semibold text-[#355f4c] underline underline-offset-4 hover:text-[#263b30] dark:text-[#b5c9b5] dark:hover:text-white">
              All cohorts
            </Link>
            <h1 className="mt-4 font-serif text-3xl font-semibold text-[#26312d] dark:text-[#f2eee4]">{cohort.name}</h1>
            {cohort.description && (
              <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">{cohort.description}</p>
            )}
          </header>

            <p className="border-y border-[#d9d5ca] py-3 text-sm leading-6 text-[#59685e] dark:border-[#394941] dark:text-[#c0c8bf]">
              Cohort admins can see your sign-in times, estimated active time, and learning actions such as course and lesson visits, assessment submissions, and discussion activity. Activity is kept for 90 days. Answers and discussion message contents are not included in this activity history.
            </p>

          {notice && (
            <p role={notice.isError ? "alert" : "status"} className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              {notice.message}
            </p>
          )}

          <section aria-labelledby="cohort-courses-heading">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d9d5ca] pb-3 dark:border-[#394941]">
              <h2 id="cohort-courses-heading" className="font-serif text-2xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Cohort courses</h2>
              <span className="text-sm tabular-nums text-[#59685e] dark:text-[#c0c8bf]">{availableCourses.length} available</span>
            </div>
            {availableCourses.length ? (
              <ul className="divide-y divide-[#d9d5ca] dark:divide-[#394941]">
                {availableCourses.map((course) => (
                  <li key={String(course._id)} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#26312d] dark:text-[#f2eee4]">{course.title}</h3>
                      {course.description && <p className="mt-1 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">{course.description}</p>}
                      <p className="mt-2 text-xs text-[#59685e] dark:text-[#c0c8bf]">
                        {course.status === "ready" ? `${course.chapterCount} modules` : course.status === "processing" ? "Study materials are being prepared" : course.status === "comingSoon" ? "Coming soon" : "Materials are being updated"}
                      </p>
                    </div>
                    <Link
                      href={`/courses/${course._id}`}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center border border-[#355f4c] bg-[#355f4c] px-4 text-sm font-semibold text-[#fffdf8] transition-colors hover:bg-[#263b30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d] dark:hover:bg-[#b5c9b5] dark:focus-visible:outline-[#d7bd7a]"
                    >
                      {course.status === "ready" ? "Open course" : "View course"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-5 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">There are no available courses in this cohort right now.</p>
            )}
          </section>

          <section aria-labelledby="cohort-discussion-heading">
            <header className="border-b border-[#d9d5ca] pb-3 dark:border-[#394941]">
              <h2 id="cohort-discussion-heading" className="font-serif text-2xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Group discussion</h2>
              <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
                Start a topic or reply to another learner. Only members of this cohort can read or post here.
              </p>
            </header>

            <form action={createCohortDiscussionAction} className="mt-5 space-y-4 border border-[#d9d5ca] bg-[#eeece4] p-4 sm:p-5 dark:border-[#394941] dark:bg-[#1e2b25]">
              <input type="hidden" name="cohortId" value={id} />
              <h3 className="font-semibold text-[#26312d] dark:text-[#f2eee4]">Start a topic</h3>
              <label className="block text-sm font-medium text-[#35463c] dark:text-[#d0d8d0]">
                Topic title
                <input
                  name="title"
                  required
                  maxLength={120}
                  className="mt-2 block min-h-11 w-full border border-[#b8b4a9] bg-[#fffdf8] px-3 py-2 text-sm text-[#26312d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:bg-[#17211d] dark:text-[#f2eee4] dark:focus-visible:outline-[#9abd9f]"
                />
              </label>
              <label className="block text-sm font-medium text-[#35463c] dark:text-[#d0d8d0]">
                Message
                <textarea
                  name="body"
                  required
                  maxLength={5000}
                  rows={4}
                  className="mt-2 block w-full border border-[#b8b4a9] bg-[#fffdf8] px-3 py-2 text-sm leading-6 text-[#26312d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:bg-[#17211d] dark:text-[#f2eee4] dark:focus-visible:outline-[#9abd9f]"
                />
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center border border-[#355f4c] bg-[#355f4c] px-5 text-sm font-semibold text-[#fffdf8] transition-colors hover:bg-[#263b30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d] dark:hover:bg-[#b5c9b5] dark:focus-visible:outline-[#d7bd7a]">
                Publish topic
              </button>
            </form>

            <div className="mt-6">
              {threads.length ? (
                <ol className="divide-y divide-[#d9d5ca] border-y border-[#d9d5ca] dark:divide-[#394941] dark:border-[#394941]">
                  {threads.map((thread) => (
                    <li key={String(thread._id)} className="py-6">
                      <article>
                        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">{thread.title}</h3>
                          <p className="text-xs text-[#59685e] dark:text-[#c0c8bf]">
                            {authorNames.get(thread.authorId) ?? "Learner"} · <time dateTime={thread.createdAt.toISOString()}>{formatDate(thread.createdAt)}</time>
                          </p>
                        </header>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#35463c] dark:text-[#d0d8d0]">{thread.body}</p>
                      </article>

                      {thread.replies.length > 0 && (
                        <ol className="mt-5 space-y-4 border-l border-[#b8b4a9] pl-4 sm:ml-4 sm:pl-5 dark:border-[#59695e]">
                          {thread.replies.map((reply) => (
                            <li key={String(reply._id)}>
                              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <p className="text-sm font-semibold text-[#35463c] dark:text-[#d0d8d0]">{authorNames.get(reply.authorId) ?? "Learner"}</p>
                                <time dateTime={reply.createdAt.toISOString()} className="text-xs text-[#59685e] dark:text-[#c0c8bf]">{formatDate(reply.createdAt)}</time>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#35463c] dark:text-[#d0d8d0]">{reply.body}</p>
                            </li>
                          ))}
                        </ol>
                      )}

                      <form action={replyToCohortDiscussionAction} className="mt-5 space-y-3 sm:ml-4">
                        <input type="hidden" name="cohortId" value={id} />
                        <input type="hidden" name="threadId" value={String(thread._id)} />
                        <label htmlFor={`reply-${thread._id}`} className="block text-sm font-medium text-[#35463c] dark:text-[#d0d8d0]">Reply to this topic</label>
                        <textarea
                          id={`reply-${thread._id}`}
                          name="body"
                          required
                          maxLength={3000}
                          rows={2}
                          className="block w-full border border-[#b8b4a9] bg-[#fffdf8] px-3 py-2 text-sm leading-6 text-[#26312d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:bg-[#17211d] dark:text-[#f2eee4] dark:focus-visible:outline-[#9abd9f]"
                        />
                        <button type="submit" className="inline-flex min-h-10 items-center justify-center border border-[#8b9b8b] px-4 text-sm font-semibold text-[#355f4c] transition-colors hover:bg-[#e9eee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#59695e] dark:text-[#b5c9b5] dark:hover:bg-[#2b3a32] dark:focus-visible:outline-[#d7bd7a]">
                          Post reply
                        </button>
                      </form>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border-y border-[#d9d5ca] py-6 text-sm leading-6 text-[#59685e] dark:border-[#394941] dark:text-[#c0c8bf]">
                  No topics yet. Start the first conversation for your cohort.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </LearnerWorkspaceLayout>
  );
}
