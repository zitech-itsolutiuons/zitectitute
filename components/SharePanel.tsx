"use client";

import { useState } from "react";

const btn =
  "border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function SharePanel({
  courseId,
  initialEnabled,
  initialCode,
  origin,
}: {
  courseId: string;
  initialEnabled: boolean;
  initialCode: string | null;
  origin: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function update(body: { enabled?: boolean; reset?: boolean }) {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`/api/courses/${courseId}/sharing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update sharing");
      setEnabled(data.sharingEnabled);
      setCode(data.shareCode);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const link = code ? `${origin}/join/${code}` : "";

  return (
    <section aria-labelledby="share-heading" className="border border-blue-200 bg-blue-50/30 p-5">
      <h2 id="share-heading" className="text-lg font-semibold text-blue-700">
        Invite students
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Anyone with the link can add this course to their list after signing in. They must purchase it or use a valid 100% promo code to unlock lessons.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" aria-pressed={enabled} disabled={busy} onClick={() => update({ enabled: !enabled })} className={btn}>
          {enabled ? "Link is on. Turn off" : "Turn on join link"}
        </button>
        {enabled && (
          <button
            type="button"
            disabled={busy}
            onClick={() => confirm("The old link will stop working for new students. Create a new one?") && update({ reset: true })}
            className={btn}
          >
            Create a new link
          </button>
        )}
      </div>

      {enabled && link && (
        <div className="mt-4 space-y-3">
          {code && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="course-share-code" className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                Course code
                <input
                  id="course-share-code"
                  readOnly
                  value={code}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-1 block min-h-10 w-full border border-blue-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                className={`${btn} self-end`}
                onClick={async () => {
                  await navigator.clipboard.writeText(code).catch(() => {});
                  setNote("Course code copied.");
                }}
              >
                Copy code
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              readOnly
              aria-label="Join link"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              className={btn}
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => {});
                setNote("Link copied.");
              }}
            >
              Copy link
            </button>
          </div>
        </div>
      )}
      {!enabled && <p className="mt-3 text-sm text-zinc-500">New students can’t use this link. Existing course purchases remain active.</p>}
      {note && (
        <p role="status" className="mt-3 text-sm">
          {note}
        </p>
      )}
    </section>
  );
}
