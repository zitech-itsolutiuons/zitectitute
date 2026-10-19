"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import CourseCategorySelect, { type CourseCategoryOption } from "@/components/admin/CourseCategorySelect";
import { resolveChapterVideo } from "@/lib/chapterVideo";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function UploadForm({
  courseId,
  categories = [],
}: {
  courseId?: string;
  categories?: CourseCategoryOption[];
} = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<"document" | "video">("document");
  const [file, setFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [lessons, setLessons] = useState([{ title: "", videoUrl: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!courseId && mode === "video") {
      setBusy(true);
      setError("");
      const form = new FormData(e.currentTarget);
      form.set("title", videoTitle);
      form.set("description", videoDescription);
      form.set("lessons", JSON.stringify(lessons));
      try {
        const response = await fetch("/api/admin/video-courses", {
          method: "POST",
          body: form,
        });
        const data: { courseId?: string; error?: string } = await response.json().catch(() => ({}));
        if (!response.ok || !data.courseId) throw new Error(data.error ?? "The video course could not be created.");
        router.push(`/courses/${data.courseId}/edit`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The video course could not be created.");
        setBusy(false);
      }
      return;
    }
    if (!file) return;
    setBusy(true);
    setError("");
    const body = new FormData(e.currentTarget);
    if (courseId) body.append("courseId", courseId);
    try {
      const res = await fetch("/api/courses", { method: "POST", body });
      if (res.status === 401) return router.push("/signin");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed. Try again.");
      router.push(courseId ? `/admin/courses/${courseId}` : `/courses/${data.courseId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const videoLessonsValid = lessons.every((lesson) => lesson.title.trim() && resolveChapterVideo(lesson.videoUrl));

  return (
    <form onSubmit={submit} className="min-w-0 border border-blue-200 bg-blue-50/30 p-4 sm:p-5">
      {!courseId && (
        <>
          <fieldset className="mb-5">
            <legend className="text-sm font-medium text-slate-800">Course format</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([
                ["document", "Build from a document"],
                ["video", "Video lessons"],
              ] as const).map(([value, label]) => (
                <label key={value} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 border px-3 text-sm font-medium ${mode === value ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-300 bg-white text-[#46564c] hover:bg-slate-50"}`}>
                  <input
                    type="radio"
                    name="course-format"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="accent-emerald-800"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <CourseCategorySelect categories={categories} id="new-course-category" />
          <label className="mt-5 block text-sm font-medium text-slate-800">
            Course cover
            <span className="ml-1 font-normal text-slate-500">JPG, PNG or WebP · up to 5 MB</span>
            <input
              name="coverImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={busy}
              className={`mt-2 block min-h-11 w-full min-w-0 border border-blue-200 bg-white p-2 text-sm file:mr-3 file:border file:border-blue-200 file:bg-transparent file:px-3 file:py-1 file:text-sm ${focus}`}
            />
          </label>
        </>
      )}
      {(!courseId && mode === "video") ? (
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-800">
            Course title
            <input
              value={videoTitle}
              onChange={(event) => setVideoTitle(event.target.value)}
              required
              maxLength={200}
              className={`mt-2 block min-h-11 w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`}
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Description <span className="font-normal text-slate-500">(optional)</span>
            <textarea
              value={videoDescription}
              onChange={(event) => setVideoDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              className={`mt-2 block w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`}
            />
          </label>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Lessons</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">Add a title and a YouTube, Vimeo, or direct MP4, WebM, or Ogg video link for each lesson.</p>
            </div>
            {lessons.map((lesson, index) => (
              <fieldset key={index} className="space-y-3 border-t border-blue-200 pt-4">
                <legend className="sr-only">Lesson {index + 1}</legend>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Lesson {index + 1}</p>
                  {lessons.length > 1 && (
                    <button
                      type="button"
                      data-loading-ignore
                      onClick={() => setLessons((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                      Remove lesson
                    </button>
                  )}
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Lesson title
                  <input
                    value={lesson.title}
                    onChange={(event) => setLessons((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                    required
                    maxLength={200}
                    className={`mt-1 block min-h-11 w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Video URL
                  <input
                    type="url"
                    value={lesson.videoUrl}
                    onChange={(event) => setLessons((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, videoUrl: event.target.value } : item))}
                    required
                    maxLength={2000}
                    placeholder="https://..."
                    className={`mt-1 block min-h-11 w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`}
                  />
                </label>
              </fieldset>
            ))}
            <button
              type="button"
              data-loading-ignore
              disabled={lessons.length >= 100}
              onClick={() => setLessons((current) => [...current, { title: "", videoUrl: "" }])}
              className={`min-h-10 border border-blue-200 bg-white px-3 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50 ${focus}`}
            >
              Add another lesson
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <label htmlFor="file" className="block text-sm font-medium text-blue-700">
            Document (PDF, DOCX, TXT or Markdown, up to 15 MB)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`mt-3 block min-h-11 w-full min-w-0 border border-blue-200 bg-white p-2 text-sm file:mr-3 file:border file:border-blue-200 file:bg-transparent file:px-3 file:py-1 file:text-sm ${focus}`}
          />
        </div>
      )}
      <button
        type="submit"
        disabled={busy || (!courseId && categories.length === 0) || (!courseId && mode === "video" ? !videoTitle.trim() || !videoLessonsValid : !file)}
        className={`mt-4 border border-blue-600 bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-30 hover:bg-blue-700 ${focus}`}
      >
        {busy ? mode === "video" ? "Creating video course…" : "Uploading…" : courseId ? "Add study materials" : mode === "video" ? "Create video course" : "Create course"}
      </button>
      {busy && (
        <p role="status" className="mt-3 text-sm text-zinc-500">
          {mode === "video" ? "Creating the course and adding its video lessons." : "Uploading your document. The course builds in the background and you will see its progress next."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
          {error}
        </p>
      )}
    </form>
  );
}
