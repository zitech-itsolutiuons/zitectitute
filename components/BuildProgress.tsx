"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type BuildStatus = {
  status: "processing" | "ready" | "failed";
  stage: string;
  title: string;
  totalChapters: number;
  lecturesDone: number;
  quizzesDone: number;
  error?: string;
};

// A real sequence, so ordered markers carry information here.
const STAGES = [
  { id: "parsing", label: "Reading the document" },
  { id: "outline", label: "Planning the modules" },
  { id: "writing", label: "Writing modules and quizzes" },
  { id: "saving", label: "Saving the course" },
];

export default function BuildProgress({ courseId, initial }: { courseId: string; initial: BuildStatus }) {
  const router = useRouter();
  const [s, setS] = useState<BuildStatus>(initial);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/courses/${courseId}/status`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next: BuildStatus = await res.json();
        setS(next);
        if (next.status === "ready") {
          stopped = true;
          router.refresh(); // the server page now renders the reader
        } else if (next.status === "failed") stopped = true;
      } catch {
        /* network blip: try again on the next tick */
      }
    }
    poll();
    const t = setInterval(() => !stopped && poll(), 2000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [courseId, router]);

  if (s.status === "failed") {
    return (
      <div role="alert">
        <h1 className="text-2xl font-semibold">This course could not be built</h1>
        <p className="mt-4 border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
          {s.error ?? "Something went wrong. Upload the document again."}
        </p>
        <Link href="/courses" className="mt-6 inline-block text-sm underline underline-offset-4 text-blue-700">
          Back to your courses
        </Link>
      </div>
    );
  }

  const current = Math.max(0, STAGES.findIndex((x) => x.id === s.stage));
  const total = s.totalChapters;
  const pct = total > 0 ? Math.round(((s.lecturesDone + s.quizzesDone) / (2 * total)) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Building your course. You can leave this page and come back.</p>

      <ol className="mt-8 border border-blue-200">
        {STAGES.map((st, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={st.id}
              aria-current={active ? "step" : undefined}
              className={`flex items-start gap-3 border-0 border-b border-blue-100 px-4 py-3 text-sm last:border-b-0 ${
                active ? "bg-blue-600 text-white" : ""
              } ${!done && !active ? "text-zinc-500" : ""}`}
            >
              <span className={`mt-1 h-3 w-3 shrink-0 border border-current ${done ? "bg-current" : ""}`} />
              <div className="min-w-0 flex-1">
                <p>{st.label}</p>
                {st.id === "writing" && active && total > 0 && (
                  <>
                    <p className="mt-1 text-xs opacity-70">
                      Modules {s.lecturesDone} of {total}. Quizzes {s.quizzesDone} of {total}.
                    </p>
                    <div className="mt-2 h-1 w-full bg-zinc-500/40" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-current" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
