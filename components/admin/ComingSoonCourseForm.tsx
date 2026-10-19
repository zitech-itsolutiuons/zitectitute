"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import CourseCategorySelect, { type CourseCategoryOption } from "@/components/admin/CourseCategorySelect";

export default function ComingSoonCourseForm({ categories }: { categories: CourseCategoryOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/courses/coming-soon", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result: { courseId?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !result.courseId) throw new Error(result.error ?? "The course could not be created.");
      router.push(`/admin/courses/${result.courseId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The course could not be created.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-slate-200 bg-white p-5">
      <label className="block text-sm font-medium text-slate-700">
        Course title
        <input name="title" required maxLength={200} disabled={busy} className="mt-2 block w-full border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Description <span className="font-normal text-slate-500">(optional)</span>
        <textarea name="description" maxLength={1000} rows={3} disabled={busy} className="mt-2 block w-full resize-y border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <CourseCategorySelect
        id="coming-soon-category"
        categories={categories}
      />
      <label className="block text-sm font-medium text-slate-700">
        Course cover <span className="font-normal text-slate-500">JPG, PNG or WebP · up to 5 MB</span>
        <input name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} className="mt-2 block min-h-11 w-full border border-slate-300 bg-white p-2 text-sm file:mr-3 file:border file:border-slate-300 file:bg-transparent file:px-3 file:py-1 file:text-sm" />
      </label>
      <p className="text-xs leading-5 text-slate-500">Students will see it in the course list as Coming soon until you add study materials.</p>
      <button type="submit" disabled={busy || categories.length === 0} className="min-h-11 border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
        {busy ? "Creating course…" : "Create coming-soon course"}
      </button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
