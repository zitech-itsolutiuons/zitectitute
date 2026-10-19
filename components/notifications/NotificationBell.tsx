"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [countUnavailable, setCountUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/notifications?count=1", { cache: "no-store" });
        if (!response.ok) throw new Error("Notification count could not be refreshed.");
        const data = await response.json();
        if (active && Number.isInteger(data.unreadCount)) {
          setUnreadCount(data.unreadCount);
          setCountUnavailable(false);
        }
      } catch {
        if (active) setCountUnavailable(true);
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={`${unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}${countUnavailable ? ". Unread count may be out of date" : ""}`}
      title={countUnavailable ? "Unread count could not be refreshed" : undefined}
      className="relative inline-flex min-h-9 items-center gap-2 font-medium text-[#46564c] underline-offset-4 hover:text-[#263b30] hover:underline dark:text-[#d0d8d0] dark:hover:text-white"
    >
      <span>Notifications</span>
      {unreadCount > 0 && (
        <span aria-hidden="true" className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#355f4c] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white dark:bg-[#9abd9f] dark:text-[#17211d]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {countUnavailable && <span className="text-[10px] text-[#7a5319] dark:text-[#e2c77f]">Count unavailable</span>}
    </Link>
  );
}
