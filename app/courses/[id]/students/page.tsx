import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ManageTabs from "@/components/ManageTabs";
import RemoveStudentButton from "@/components/RemoveStudentButton";
import SharePanel from "@/components/SharePanel";
import { getCourseAccess } from "@/lib/access";
import { loadAnalytics } from "@/lib/analytics";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "None yet" : `${Math.round(x * 100)}%`);
const date = (d: Date | null) => (d ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(d) : "Never");
const th = "px-3 py-2 text-left text-xs font-medium text-zinc-500";
const td = "px-3 py-3 align-top";

function Bar({ value }: { value: number | null }) {
  return (
    <div className="mt-1 h-1.5 w-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
      <div className="h-full bg-black dark:bg-white" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
    </div>
  );
}

export default async function StudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  const access = await getCourseAccess(id, userId);
  if (!access || access.role !== "owner") notFound();
  const { course } = access;

  const data = await loadAnalytics(id, userId);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { summary } = data;

  const hardest = data.chapters
    .flatMap((c) => c.questions.map((q) => ({ ...q, chapter: c.title })))
    .filter((q) => q.pctCorrect !== null)
    .sort((a, b) => (a.pctCorrect as number) - (b.pctCorrect as number))
    .slice(0, 5);

  const tiles = [
    { label: "Students", value: String(summary.students) },
    { label: "Average completion", value: pct(summary.avgCompletion) },
    { label: "Average quiz score", value: pct(summary.avgScore) },
    { label: "Assistant questions", value: String(summary.assistantMessages) },
  ];

  return (
    <>
      <ManageTabs courseId={id} title={course.title} active="students" />
      <main className="mx-auto max-w-6xl space-y-10 px-5 py-10 md:px-10">
        <SharePanel courseId={id} initialEnabled={!!course.sharingEnabled} initialCode={course.shareCode ?? null} origin={origin} />

        {summary.students === 0 ? (
          <p className="text-zinc-500">No students yet. Turn on the join link above and send it to your class.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-px border border-black bg-black md:grid-cols-4 dark:border-white dark:bg-white">
              {tiles.map((t) => (
                <div key={t.label} className="bg-white p-4 dark:bg-black">
                  <dt className="text-xs text-zinc-500">{t.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">{t.value}</dd>
                </div>
              ))}
            </dl>
            <p className="-mt-6 text-xs text-zinc-500">{summary.activeThisWeek} of {summary.students} students active in the last 7 days.</p>

            <section aria-labelledby="modules-h">
              <h2 id="modules-h" className="mb-3 text-lg font-semibold">By module</h2>
              <div className="overflow-x-auto border border-black dark:border-white">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="border-0 border-b border-black dark:border-white">
                    <tr>
                      <th className={th}>Module</th>
                      <th className={th}>Completed</th>
                      <th className={th}>Quiz average (best attempt)</th>
                      <th className={th}>Attempts</th>
                      <th className={th}>Assistant questions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.chapters.map((c, i) => (
                      <tr key={c.id} className="border-0 border-b border-zinc-300 last:border-b-0 dark:border-zinc-800">
                        <td className={td}>
                          {i + 1}. {c.title}
                          {c.avgBest !== null && c.avgBest < 0.6 && (
                            <span className="ml-2 border border-black px-1.5 py-0.5 text-xs dark:border-white">Below 60%</span>
                          )}
                        </td>
                        <td className={td}>{c.completed} of {summary.students}<Bar value={summary.students ? c.completed / summary.students : 0} /></td>
                        <td className={td}>{pct(c.avgBest)}<Bar value={c.avgBest} /></td>
                        <td className={td}>{c.attempts}</td>
                        <td className={td}>{c.asked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {hardest.length > 0 && (
              <section aria-labelledby="hard-h">
                <h2 id="hard-h" className="text-lg font-semibold">Hardest quiz questions</h2>
                <p className="mb-3 text-sm text-zinc-500">Based on each student's latest attempt since the quiz was last edited.</p>
                <ol className="border border-black dark:border-white">
                  {hardest.map((q, i) => (
                    <li key={i} className="flex gap-4 border-0 border-b border-zinc-300 px-4 py-3 text-sm last:border-b-0 dark:border-zinc-800">
                      <span className="w-14 shrink-0 font-semibold">{pct(q.pctCorrect)}</span>
                      <span>
                        {q.question}
                        <span className="block text-xs text-zinc-500">{q.chapter}. {q.n} {q.n === 1 ? "answer" : "answers"}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section aria-labelledby="students-h">
              <h2 id="students-h" className="mb-3 text-lg font-semibold">Students</h2>
              <div className="overflow-x-auto border border-black dark:border-white">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="border-0 border-b border-black dark:border-white">
                    <tr>
                      <th className={th}>Student</th>
                      <th className={th}>Modules completed</th>
                      <th className={th}>Quiz average</th>
                      <th className={th}>Assistant questions</th>
                      <th className={th}>Last active</th>
                      <th className={th}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => {
                      const label = s.name || s.email || "this student";
                      return (
                        <tr key={s.userId} className="border-0 border-b border-zinc-300 last:border-b-0 dark:border-zinc-800">
                          <td className={td}>
                            {s.name ?? s.email ?? "Unnamed student"}
                            {s.name && s.email && <span className="block text-xs text-zinc-500">{s.email}</span>}
                          </td>
                          <td className={td}>{s.completed} of {data.chapters.length}</td>
                          <td className={td}>{pct(s.avgScore)}</td>
                          <td className={td}>{s.assistantMessages}</td>
                          <td className={td}>{date(s.lastActive)}</td>
                          <td className={td}><RemoveStudentButton courseId={id} userId={s.userId} label={label} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
