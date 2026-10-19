"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import { CohortDiscussion } from "@/lib/models/CohortDiscussion";
import { recordCohortActivity } from "@/lib/cohortActivity";

async function requireCohortMember(cohortId: string) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!isValidObjectId(cohortId)) redirect("/cohorts?notice=unavailable");
  await connectDB();
  if (!(await Cohort.exists({ _id: cohortId, memberUserIds: userId }))) {
    redirect("/cohorts?notice=unavailable");
  }
  return userId;
}

function cohortPath(cohortId: string) {
  return `/cohorts/${encodeURIComponent(cohortId)}`;
}

export async function createCohortDiscussionAction(formData: FormData) {
  const cohortId = String(formData.get("cohortId") ?? "");
  const userId = await requireCohortMember(cohortId);
  const titleValue = formData.get("title");
  const bodyValue = formData.get("body");
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const body = typeof bodyValue === "string" ? bodyValue.trim() : "";

  if (!title || title.length > 120 || !body || body.length > 5000) {
    redirect(`${cohortPath(cohortId)}?notice=invalid-topic`);
  }

  await CohortDiscussion.create({ cohortId, authorId: userId, title, body });
  await recordCohortActivity({
    userId,
    cohortId,
    type: "discussion-started",
    label: "Started a cohort discussion",
  });
  revalidatePath("/cohorts");
  revalidatePath(cohortPath(cohortId));
}

export async function replyToCohortDiscussionAction(formData: FormData) {
  const cohortId = String(formData.get("cohortId") ?? "");
  const userId = await requireCohortMember(cohortId);
  const threadId = String(formData.get("threadId") ?? "");
  const bodyValue = formData.get("body");
  const body = typeof bodyValue === "string" ? bodyValue.trim() : "";

  if (!isValidObjectId(threadId)) redirect(`${cohortPath(cohortId)}?notice=missing-thread`);
  if (!body || body.length > 3000) redirect(`${cohortPath(cohortId)}?notice=invalid-reply`);

  const thread = await CohortDiscussion.findOneAndUpdate(
    { _id: threadId, cohortId },
    { $push: { replies: { authorId: userId, body } } },
    { new: true }
  ).select("_id");
  if (!thread) redirect(`${cohortPath(cohortId)}?notice=missing-thread`);

  await recordCohortActivity({
    userId,
    cohortId,
    type: "discussion-replied",
    label: "Replied to a cohort discussion",
  });
  revalidatePath("/cohorts");
  revalidatePath(cohortPath(cohortId));
}
