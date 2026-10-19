"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  endCohortActivitySessionAction,
  recordCohortActivityHeartbeatAction,
  refreshUserActivityAction,
  startCohortActivitySessionAction,
} from "@/app/session-actions";
import { SESSION_ACTIVITY_REFRESH_MS, USER_IDLE_TIMEOUT_MS } from "@/lib/sessionPolicy";

const COHORT_ACTIVE_IDLE_MS = 5 * 60 * 1000;

export default function SessionActivityTracker({ isAdmin }: { isAdmin: boolean }) {
  useEffect(() => {
    if (isAdmin) return;

    let sessionId: string | null = null;
    let lastRefreshAt = 0;
    let lastInteractionAt = Date.now();
    let updatingSession = false;
    let isExpiring = false;
    let idleTimer = 0;
    let heartbeatTimer = 0;
    const expireSession = async () => {
      if (isExpiring) return;
      isExpiring = true;
      try {
        await endCohortActivitySessionAction();
      } catch (error) {
        console.error("Could not close the cohort activity session", error);
      }
      await signOut({ redirectTo: "/signin?reason=inactive" });
    };
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(expireSession, USER_IDLE_TIMEOUT_MS);
    };
    const recordActivity = () => {
      resetIdleTimer();
      lastInteractionAt = Date.now();
      const now = Date.now();
      if (now - lastRefreshAt < SESSION_ACTIVITY_REFRESH_MS) return;
      lastRefreshAt = now;
      void refreshUserActivityAction().then((active) => {
        if (!active) expireSession();
      }).catch((error: unknown) => {
        console.error("Could not refresh the learner session", error);
      });
    };
    const updateCohortSession = async () => {
      if (updatingSession) return;
      updatingSession = true;
      try {
        if (!sessionId) sessionId = await startCohortActivitySessionAction();
        if (!sessionId) return;
        const active = document.visibilityState === "visible" &&
          Date.now() - lastInteractionAt < COHORT_ACTIVE_IDLE_MS;
        const stillOpen = await recordCohortActivityHeartbeatAction(sessionId, active);
        if (!stillOpen) sessionId = null;
      } catch (error) {
        console.error("Could not update the cohort activity session", error);
      } finally {
        updatingSession = false;
      }
    };
    const heartbeat = () => void updateCohortSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    recordActivity();
    heartbeat();
    heartbeatTimer = window.setInterval(heartbeat, SESSION_ACTIVITY_REFRESH_MS);
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(idleTimer);
      window.clearInterval(heartbeatTimer);
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAdmin]);

  return null;
}