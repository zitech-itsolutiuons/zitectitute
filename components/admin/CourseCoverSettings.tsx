"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CourseCoverSettings({
  courseId,
  courseTitle,
  hasCover,
  archived,
}: {
  courseId: string;
  courseTitle: string;
  hasCover: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cacheKey, setCacheKey] = useState("current");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/cover`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result: { error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "The course cover could not be saved.");

      setCacheKey(String(Date.now()));
      setSuccess("Course cover saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The course cover could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="max-w-sm text-xs">
      <summary className="cursor-pointer font-medium text-emerald-800 underline underline-offset-4 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
        Cover settings
      </summary>
      <div className="mt-3 space-y-3 border border-slate-200 bg-slate-50 p-3">
        {hasCover && !archived ? (
          <img
            key={cacheKey}
            src={`/api/courses/${courseId}/cover?v=${cacheKey}`}
            alt={`Current cover for ${courseTitle}`}
            className="h-28 w-full rounded-md object-cover"
          />
        ) : hasCover ? (
          <p className="text-slate-600">A cover is saved. Restore this course to preview it.</p>
        ) : (
          <p className="text-slate-600">No cover image has been added yet.</p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block font-medium text-slate-700">
            {hasCover ? "Replace cover image" : "Add a cover image"}
            <span className="mt-1 block font-normal text-slate-500">JPG, PNG or WebP · up to 5 MB</span>
            <input
              name="coverImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={busy}
              className="mt-2 block min-h-11 w-full border border-slate-300 bg-white p-2 text-xs file:mr-3 file:border file:border-slate-300 file:bg-transparent file:px-2 file:py-1 file:text-xs disabled:opacity-50"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-10 border border-emerald-900 bg-emerald-900 px-3 font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            {busy ? "Saving cover…" : "Save cover"}
          </button>
          {error && <p role="alert" className="text-rose-700">{error}</p>}
          {success && <p role="status" className="text-emerald-800">{success}</p>}
        </form>
      </div>
    </details>
  );
}
