"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { auth, unstable_update } from "@/auth";
import { connectDB } from "@/lib/db";
import { COHORT_ACTIVITY_SESSION_COOKIE, recordCohortActivity } from "@/lib/cohortActivity";
import { Cohort } from "@/lib/models/Cohort";
import { CohortActivitySession } from "@/lib/models/CohortActivitySession";

export async function refreshUserActivityAction(): Promise<boolean> {
  const session = await auth();
  if (!session?.user || session.user.platformRestricted || session.user.role === "admin") return false;
  await unstable_update({});
  return true;
}

export async function startCohortActivitySessionAction(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.platformRestricted || session.user.role === "admin") return null;
  await connectDB();

  const cohortIds = await Cohort.distinct("_id", { memberUserIds: session.user.id });
  if (!cohortIds.length) return null;

  const cookieStore = await cookies();
  const existingId = cookieStore.get(COHORT_ACTIVITY_SESSION_COOKIE)?.value;
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const existing = existingId
    ? await CohortActivitySession.findOne({
        sessionId: existingId,
        userId: session.user.id,
        endedAt: null,
        startedAt: { $gte: cutoff },
      }).select("sessionId").lean()
    : null;
  if (existing) {
    await CohortActivitySession.updateOne(
      { sessionId: existing.sessionId },
      { $addToSet: { cohortIds: { $each: cohortIds } } }
    );
    return existing.sessionId;
  }

  const sessionId = randomUUID();
  const now = new Date();
  await CohortActivitySession.create({
    sessionId,
    userId: session.user.id,
    cohortIds,
    startedAt: now,
    lastSeenAt: now,
  });
  cookieStore.set(COHORT_ACTIVITY_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  await recordCohortActivity({ userId: session.user.id, type: "signed-in", label: "Signed in" });
  return sessionId;
}

export async function recordCohortActivityHeartbeatAction(
  sessionId: string,
  active: boolean
): Promise<boolean> {
  const session = await auth();
  if (!session?.user || session.user.platformRestricted || session.user.role === "admin") return false;
  await connectDB();
  const cohortIds = await Cohort.distinct("_id", { memberUserIds: session.user.id });
  if (!cohortIds.length) return false;

  const now = new Date();
  const elapsedSeconds = active
    ? {
        $min: [
          90,
          {
            $max: [
              0,
              { $floor: { $divide: [{ $subtract: [now, "$lastSeenAt"] }, 1000] } },
            ],
          },
        ],
      }
    : 0;
  const result = await CohortActivitySession.updateOne(
    { sessionId, userId: session.user.id, endedAt: null, startedAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
    [
      {
        $set: {
          activeSeconds: { $add: [{ $ifNull: ["$activeSeconds", 0] }, elapsedSeconds] },
          cohortIds: { $setUnion: [{ $ifNull: ["$cohortIds", []] }, cohortIds] },
          ...(active ? { lastSeenAt: now } : {}),
        },
      },
    ]
  );
  return result.matchedCount > 0;
}

export async function endCohortActivitySessionAction(): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.platformRestricted) return;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COHORT_ACTIVITY_SESSION_COOKIE)?.value;
  if (!sessionId) return;

  await connectDB();
  await CohortActivitySession.updateOne(
    { sessionId, userId: session.user.id, endedAt: null },
    { $set: { endedAt: new Date() } }
  );
  if (session.user.role !== "admin") {
    await recordCohortActivity({ userId: session.user.id, type: "signed-out", label: "Signed out" });
  }
  cookieStore.delete(COHORT_ACTIVITY_SESSION_COOKIE);
}