import { cookies } from "next/headers";
import { Cohort } from "@/lib/models/Cohort";
import { CohortActivity, type cohortActivityTypes } from "@/lib/models/CohortActivity";

export const COHORT_ACTIVITY_SESSION_COOKIE = "cohort_activity_session";

type CohortActivityType = (typeof cohortActivityTypes)[number];

export async function recordCohortActivity({
  userId,
  type,
  label,
  cohortId,
  courseId,
  chapterId,
}: {
  userId: string;
  type: CohortActivityType;
  label: string;
  cohortId?: string;
  courseId?: string;
  chapterId?: string;
}) {
  const cohortQuery: Record<string, unknown> = { memberUserIds: userId };
  if (cohortId) cohortQuery._id = cohortId;
  if (courseId) cohortQuery.courseIds = courseId;
  const cohortIds = await Cohort.distinct("_id", cohortQuery);
  if (!cohortIds.length) return;

  const cookieStore = await cookies();
  await CohortActivity.create({
    userId,
    cohortIds,
    sessionId: cookieStore.get(COHORT_ACTIVITY_SESSION_COOKIE)?.value ?? "",
    type,
    courseId: courseId || null,
    chapterId: chapterId || null,
    label: label.trim().slice(0, 180),
  });
}
