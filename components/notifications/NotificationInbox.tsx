"use client";

import Link from "next/link";
import { useState } from "react";

type Item = {
  _id: string;
  type: "announcement" | "course" | "certificate" | "project" | "peer-review";
  title: string;
  message: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationInbox({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unreadCount = items.filter((item) => !item.readAt).length;

  async function markRead(id?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { markAllRead: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Notifications could not be updated.");
      const now = new Date().toISOString();
      setItems((previous) => previous.map((item) => (!id || item._id === id) ? { ...item, readAt: item.readAt ?? now } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifications could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-[-0.025em] text-[#26312d] dark:text-[#f2eee4]">Notifications</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
            Announcements, course updates, and work that needs your attention.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markRead()}
            className="min-h-10 border border-[#355f4c] px-4 text-sm font-semibold text-[#355f4c] hover:bg-[#e9f0e8] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#355f4c] dark:border-[#9abd9f] dark:text-[#d6e6d7] dark:hover:bg-[#2b3a32]"
          >
            Mark all as read
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-800 dark:text-red-300">{error}</p>}
      {items.length === 0 ? (
        <div className="py-12">
          <h2 className="font-serif text-xl font-semibold">You’re all caught up</h2>
          <p className="mt-2 text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">New announcements and course activity will appear here.</p>
        </div>
      ) : (
        <ol className="divide-y divide-[#d9d5ca] dark:divide-[#394941]">
          {items.map((item) => (
            <li key={item._id} className={`py-5 ${item.readAt ? "" : "bg-[#f0f3ed] px-4 dark:bg-[#24372b]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!item.readAt && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-[#355f4c] dark:bg-[#9abd9f]" />}
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#456b55] dark:text-[#b5c9b5]">
                      {item.type === "peer-review" ? "Peer review" : item.type.replace("-", " ")}
                    </p>
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-[#26312d] dark:text-[#f2eee4]">{item.title}</h2>
                  <p className="mt-1 max-w-[72ch] whitespace-pre-wrap text-sm leading-6 text-[#46564c] dark:text-[#d0d8d0]">{item.message}</p>
                  <time className="mt-3 block text-xs tabular-nums text-[#59685e] dark:text-[#c0c8bf]" dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                  </time>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {item.href !== "/notifications" && (
                    <Link href={item.href} className="text-sm font-semibold text-[#355f4c] underline underline-offset-4 hover:text-[#263b30] dark:text-[#b5c9b5] dark:hover:text-white">
                      Open
                    </Link>
                  )}
                  {!item.readAt && (
                    <button type="button" disabled={busy} onClick={() => void markRead(item._id)} className="text-sm text-[#59685e] underline underline-offset-4 hover:text-[#263b30] disabled:opacity-50 dark:text-[#c0c8bf] dark:hover:text-white">
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
