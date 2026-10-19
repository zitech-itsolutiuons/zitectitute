"use client";

import { useEffect, useState } from "react";

export default function NetworkStatusNotice() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const isOffline = !navigator.onLine;
      setOffline(isOffline);
      if (!isOffline) setDismissed(false);
    };

    updateStatus();
    window.addEventListener("offline", updateStatus);
    window.addEventListener("online", updateStatus);
    return () => {
      window.removeEventListener("offline", updateStatus);
      window.removeEventListener("online", updateStatus);
    };
  }, []);

  if (!offline || dismissed) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-[1100] mx-auto w-auto max-w-lg" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3 border border-amber-300 bg-white px-4 py-3 shadow-lg dark:border-amber-800 dark:bg-slate-900">
        <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" viewBox="0 0 20 20" fill="none">
          <path d="M2.5 7.5a11.5 11.5 0 0 1 15 0M5.5 10.5a7 7 0 0 1 9 0M8.5 13.5a2.5 2.5 0 0 1 3 0M3 3l14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">You’re offline</p>
          <p className="mt-0.5 text-sm leading-5 text-slate-600 dark:text-slate-300">Some features may be unavailable until your internet connection returns.</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline notice"
          className="grid h-8 w-8 shrink-0 place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}