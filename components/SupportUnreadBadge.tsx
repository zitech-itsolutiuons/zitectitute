"use client";

import { useEffect, useState } from "react";

export default function SupportUnreadBadge({
  initialCount,
  endpoint = "/api/support/unread",
}: {
  initialCount: number;
  endpoint?: string;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("Support unread count could not be refreshed.");
        const data: { unreadCount?: number } = await response.json();
        if (active && Number.isInteger(data.unreadCount)) setCount(data.unreadCount ?? 0);
      } catch (error) {
        console.error("Could not refresh support unread count", error);
      }
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [endpoint]);

  return count > 0 ? (
    <span aria-label={`${count} unread support ${count === 1 ? "message" : "messages"}`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#a13c30] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}
