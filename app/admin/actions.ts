"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { recordAdminAction } from "@/lib/adminAudit";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { HomepageContent } from "@/lib/models/HomepageContent";
import { PlatformSettings } from "@/lib/models/PlatformSettings";
import { SignupCode } from "@/lib/models/SignupCode";
import { encryptSignupCode, hashSignupCode } from "@/lib/signupCodes";
import { HomepageContentInput } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type SignupCodeActionState = { error?: string; success?: string };
export type AchievementBadgesActionState = {
  error?: string;
  success?: string;
  achievementBadgesEnabled?: boolean;
};

const SIGNUP_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateSignupCode() {
  return Array.from({ length: 6 }, () => SIGNUP_CODE_ALPHABET[randomInt(SIGNUP_CODE_ALPHABET.length)]).join("");
}

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

export async function saveSignupCodeRequirementAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  await connectDB();
  await PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $set: { requireSignupCode: formData.get("requireSignupCode") === "on", updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  await recordAdminAction({
    actorId: userId,
    action: "signup.requirement-updated",
    targetType: "platform-settings",
    details: { required: formData.get("requireSignupCode") === "on" },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/signup-access");
  revalidatePath("/signup");
  return { success: "Signup setting saved." };
}

export async function saveStudentQuizQuestionLimitAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  const limit = Number(formData.get("studentQuizQuestionLimit"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 15) {
    return { error: "Choose a number from 1 to 15." };
  }

  await connectDB();
  await PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $set: { studentQuizQuestionLimit: limit, updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  await recordAdminAction({
    actorId: userId,
    action: "settings.quiz-limit-updated",
    targetType: "platform-settings",
    details: { studentQuizQuestionLimit: limit },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/courses/[id]", "page");
  return { success: "Student quiz limit saved." };
}

export async function saveAchievementBadgesEnabledAction(
  _prev: AchievementBadgesActionState,
  formData: FormData
): Promise<AchievementBadgesActionState> {
  const userId = await requireAdmin();
  const enabled = formData.get("achievementBadgesEnabled") === "on";
  await connectDB();
  const savedSettings = await PlatformSettings.findOneAndUpdate(
    { key: "platform" },
    { $set: { achievementBadgesEnabled: enabled, updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true, new: true }
  ).select("achievementBadgesEnabled").lean();
  if (savedSettings?.achievementBadgesEnabled !== enabled) {
    return { error: "The saved value could not be confirmed. Please try again." };
  }
  await recordAdminAction({
    actorId: userId,
    action: "settings.achievement-badges-updated",
    targetType: "platform-settings",
    details: { achievementBadgesEnabled: enabled },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/courses");
  return {
    success: enabled ? "Achievement badges are now enabled for learners." : "Achievement badges are now disabled for learners.",
    achievementBadgesEnabled: savedSettings.achievementBadgesEnabled,
  };
}

export async function generateSignupCodeAction(_prev: SignupCodeActionState, formData: FormData): Promise<SignupCodeActionState> {
  const userId = await requireAdmin();
  const quantity = Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25)
    return { error: "Choose between 1 and 25 codes." };

  await connectDB();
  let codes = new Set<string>();
  let hasCollision = true;
  for (let attempt = 0; attempt < 5 && hasCollision; attempt++) {
    codes = new Set<string>();
    while (codes.size < quantity) codes.add(generateSignupCode());
    const existingCodes = await SignupCode.find({ codeHash: { $in: [...codes].map(hashSignupCode) } }).select("_id").lean();
    hasCollision = existingCodes.length > 0;
  }
  if (hasCollision) return { error: "Could not generate unique signup codes. Please try again." };

  await SignupCode.insertMany([...codes].map((code) => ({
    codeHash: hashSignupCode(code),
    encryptedCode: encryptSignupCode(code),
    createdBy: userId,
  })));
  await recordAdminAction({
    actorId: userId,
    action: "signup.codes-generated",
    targetType: "signup-codes",
    details: { quantity },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/signup-access");
  return { success: `${quantity} ${quantity === 1 ? "code" : "codes"} generated.` };
}

export async function revokeSignupCodeAction(formData: FormData) {
  const userId = await requireAdmin();
  const codeId = String(formData.get("codeId") ?? "");
  if (!/^[a-f\d]{24}$/i.test(codeId)) return;
  await connectDB();
  await SignupCode.updateOne({ _id: codeId }, { $set: { active: false } });
  await recordAdminAction({ actorId: userId, action: "signup.code-revoked", targetType: "signup-code", targetId: codeId });
  revalidatePath("/admin");
  revalidatePath("/admin/signup-access");
}

export async function saveHomepageContent(formData: FormData) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");

  const parsed = HomepageContentInput.safeParse({
    heroTitle: formData.get("heroTitle"),
    heroDescription: formData.get("heroDescription"),
    primaryCta: formData.get("primaryCta"),
    secondaryCta: formData.get("secondaryCta"),
    heroFootnote: formData.get("heroFootnote"),
    codeExampleLabel: formData.get("codeExampleLabel"),
  });
  if (!parsed.success) redirect("/admin/homepage?notice=invalid");

  await connectDB();
  await HomepageContent.findOneAndUpdate(
    { key: "home" },
    { $set: { ...parsed.data, updatedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  await recordAdminAction({ actorId: userId, action: "homepage.updated", targetType: "homepage" });
  revalidatePath("/");
  revalidatePath("/admin/homepage");
  redirect("/admin/homepage?notice=saved");
}