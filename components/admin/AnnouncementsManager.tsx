"use client";

import { useEffect, useState } from "react";

type AnnouncementItem = { _id: string; title: string; message: string; publishedAt: string };

export default function AnnouncementsManager() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/announcements", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Announcements could not be loaded.");
        if (active) setItems(data.announcements.map((item: AnnouncementItem) => ({
          ...item,
          publishedAt: new Date(item.publishedAt).toISOString(),
        })));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Announcements could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Announcement could not be published.");
      setItems((previous) => [{
        _id: crypto.randomUUID(),
        title: title.trim(),
        message: message.trim(),
        publishedAt: new Date().toISOString(),
      }, ...previous].slice(0, 100));
      setTitle("");
      setMessage("");
      setSuccess(`Published to ${data.learnerCount} learners.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Announcement could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="announcement-compose-heading">
        <h2 id="announcement-compose-heading" className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Write an announcement</h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Publishing sends an in-app notification to every learner account. Instructors and administrators do not receive learner announcements.</p>
        <form onSubmit={publish} className="mt-5 max-w-3xl space-y-4">
          <label className="block text-sm font-semibold text-[#26312d] dark:text-[#f2eee4]">
            Announcement title
            <input required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 block min-h-11 w-full border border-[#b9c3b8] bg-[#fffdf8] px-3 text-sm font-normal text-[#26312d] outline-none focus:border-[#355f4c] focus:ring-2 focus:ring-[#355f4c]/20 dark:border-[#59695e] dark:bg-[#1c2922] dark:text-[#f2eee4]" />
          </label>
          <label className="block text-sm font-semibold text-[#26312d] dark:text-[#f2eee4]">
            Message
            <textarea required minLength={3} maxLength={10_000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 block w-full border border-[#b9c3b8] bg-[#fffdf8] px-3 py-2.5 text-sm font-normal leading-6 text-[#26312d] outline-none focus:border-[#355f4c] focus:ring-2 focus:ring-[#355f4c]/20 dark:border-[#59695e] dark:bg-[#1c2922] dark:text-[#f2eee4]" />
            <span className="mt-1 block text-right text-xs tabular-nums text-[#59685e] dark:text-[#c0c8bf]">{message.length.toLocaleString()} / 10,000</span>
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>}
          {success && <p role="status" className="text-sm font-semibold text-[#355f4c] dark:text-[#b5c9b5]">{success}</p>}
          <button type="submit" disabled={busy || title.trim().length < 3 || message.trim().length < 3} className="min-h-11 border border-[#355f4c] bg-[#355f4c] px-5 text-sm font-semibold text-[#fffdf8] hover:bg-[#294a3b] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#9abd9f] dark:bg-[#9abd9f] dark:text-[#17211d] dark:hover:bg-[#b5c9b5]">
            {busy ? "Publishing…" : "Publish to learners"}
          </button>
        </form>
      </section>

      <section aria-labelledby="published-announcements-heading">
        <div className="border-b border-[#d9d5ca] pb-3 dark:border-[#394941]">
          <h2 id="published-announcements-heading" className="font-serif text-xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Published announcements</h2>
          <p className="mt-1 text-sm text-[#59685e] dark:text-[#c0c8bf]">The most recent 100 announcements are shown.</p>
        </div>
        {loading ? <p role="status" className="py-5 text-sm text-[#59685e] dark:text-[#c0c8bf]">Loading announcements…</p> : items.length === 0 ? (
          <p className="py-6 text-sm text-[#59685e] dark:text-[#c0c8bf]">Nothing published yet. Your announcement history will appear here.</p>
        ) : (
          <ol className="divide-y divide-[#d9d5ca] dark:divide-[#394941]">
            {items.map((item) => (
              <li key={item._id} className="py-5">
                <time className="text-xs tabular-nums text-[#59685e] dark:text-[#c0c8bf]" dateTime={item.publishedAt}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.publishedAt))}
                </time>
                <h3 className="mt-1 text-base font-semibold text-[#26312d] dark:text-[#f2eee4]">{item.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#46564c] dark:text-[#d0d8d0]">{item.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
