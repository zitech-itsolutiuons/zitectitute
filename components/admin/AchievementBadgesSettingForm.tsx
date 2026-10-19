"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveAchievementBadgesEnabledAction,
  type AchievementBadgesActionState,
} from "@/app/admin/actions";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function AchievementBadgesSettingForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<AchievementBadgesActionState, FormData>(
    saveAchievementBadgesEnabledAction,
    {}
  );
  const [checked, setChecked] = useState(enabled);

  useEffect(() => {
    setChecked(state.achievementBadgesEnabled ?? enabled);
  }, [enabled, state.achievementBadgesEnabled]);

  return (
    <form action={action} className="space-y-4 border-y border-slate-200 bg-white py-5">
      <label className="flex min-h-11 items-start gap-3 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          name="achievementBadgesEnabled"
          checked={checked}
          onChange={(event) => setChecked(event.currentTarget.checked)}
          className={`mt-0.5 h-5 w-5 accent-blue-700 ${focus}`}
        />
        <span>
          Enable achievement badges
          <span className="mt-1 block max-w-2xl font-normal leading-6 text-slate-600">
            Show learners their earned login-streak, completed-module, and course-completion badges.
            Turning this off hides badges without deleting progress or streak history.
          </span>
        </span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-600">
          Login tiers: 3, 7, 14, 30, and 100 days. Learning tiers are based on completed modules and certificates.
        </p>
        <button
          type="submit"
          disabled={pending}
          className={`min-h-11 shrink-0 border border-blue-700 bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50 ${focus}`}
        >
          {pending ? "Saving..." : "Save badge setting"}
        </button>
      </div>
      {!pending && state.success && (
        <div role="status" className="flex items-start gap-3 border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-950" aria-live="polite">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 shrink-0">
            <circle cx="10" cy="10" r="8" />
            <path d="m6.5 10 2.2 2.2 4.8-4.8" />
          </svg>
          <div>
            <p className="text-sm font-semibold">Settings saved</p>
            <p className="mt-0.5 text-sm leading-5">{state.success}</p>
          </div>
        </div>
      )}
      {!pending && state.error && (
        <p role="alert" className="border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950">
          Could not save badge settings. {state.error}
        </p>
      )}
    </form>
  );
}
