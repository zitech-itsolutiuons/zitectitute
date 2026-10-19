"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { PromoCode } from "@/lib/models/CourseCommerce";

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

export async function saveCoursePriceAction(formData: FormData) {
  const actorId = await requireAdmin();
  const courseId = formData.get("courseId");
  const rawPrice = String(formData.get("priceNaira") ?? "").trim();
  const catalogVisible = formData.get("catalogVisible") === "true";
  if (typeof courseId !== "string" || !isValidObjectId(courseId)) redirect("/admin/pricing?price=invalid");

  let priceKobo: number | null = null;
  if (rawPrice) {
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(rawPrice)) redirect("/admin/pricing?price=invalid");
    priceKobo = Math.round(Number(rawPrice) * 100);
    if (!Number.isSafeInteger(priceKobo) || priceKobo < 100) redirect("/admin/pricing?price=invalid");
  }

  await connectDB();
  const result = await Course.updateOne(
    { _id: courseId, archivedAt: null },
    { $set: { priceKobo, catalogVisible } },
    { runValidators: true }
  );
  if (!result.matchedCount) redirect("/admin/pricing?price=missing");
  const savedCourse = await Course.findById(courseId).select("priceKobo catalogVisible").lean();
  if (!savedCourse || savedCourse.priceKobo !== priceKobo || savedCourse.catalogVisible !== catalogVisible) {
    console.error("[admin/pricing] Course price update did not persist", { courseId });
    redirect("/admin/pricing?price=save-failed");
  }
  await recordAdminAction({
    actorId,
    action: "pricing.course-updated",
    targetType: "course",
    targetId: courseId,
    details: { priceKobo, catalogVisible },
  });
  revalidatePath("/admin/pricing");
  revalidatePath("/courses");
  revalidatePath("/");
  revalidatePath(`/courses/${courseId}`);
  redirect("/admin/pricing?price=saved");
}

export async function createPromoCodeAction(formData: FormData) {
  const adminId = await requireAdmin();
  const courseId = formData.get("courseId");
  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const discountPercent = Number(formData.get("discountPercent"));
  if (
    typeof courseId !== "string" ||
    !isValidObjectId(courseId) ||
    !/^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(rawCode) ||
    ![50, 100].includes(discountPercent)
  ) {
    redirect("/admin/pricing?promo=invalid");
  }

  await connectDB();
  const course = await Course.findOne({ _id: courseId, status: "ready", archivedAt: null })
    .select("priceKobo")
    .lean();
  if (!course || typeof course.priceKobo !== "number" || course.priceKobo < 100) {
    redirect("/admin/pricing?promo=course");
  }

  try {
    await PromoCode.create({ courseId, code: rawCode, discountPercent, createdBy: adminId });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      redirect("/admin/pricing?promo=duplicate");
    }
    await recordAdminAction({
      actorId: adminId,
      action: "pricing.promo-created",
      targetType: "course",
      targetId: courseId,
      details: { discountPercent },
    });
    throw error;
  }
  revalidatePath("/admin/pricing");
  redirect("/admin/pricing?promo=created");
}

export async function deactivatePromoCodeAction(formData: FormData) {
  const actorId = await requireAdmin();
  const promoCodeId = formData.get("promoCodeId");
  if (typeof promoCodeId !== "string" || !isValidObjectId(promoCodeId)) redirect("/admin/pricing?promo=invalid");
  await connectDB();
  const result = await PromoCode.updateOne({ _id: promoCodeId, active: true }, { $set: { active: false } });
  if (!result.matchedCount) redirect("/admin/pricing?promo=missing");
  await recordAdminAction({ actorId, action: "pricing.promo-deactivated", targetType: "promo-code", targetId: promoCodeId });
  revalidatePath("/admin/pricing");
  redirect("/admin/pricing?promo=deactivated");
}

export async function activatePromoCodeAction(formData: FormData) {
  const actorId = await requireAdmin();
  const promoCodeId = formData.get("promoCodeId");
  if (typeof promoCodeId !== "string" || !isValidObjectId(promoCodeId)) redirect("/admin/pricing?promo=invalid");

  await connectDB();
  const promo = await PromoCode.findById(promoCodeId).select("courseId active").lean();
  if (!promo || promo.active) redirect("/admin/pricing?promo=missing");
  const course = await Course.findOne({
    _id: promo.courseId,
    status: "ready",
    archivedAt: null,
    priceKobo: { $gte: 100 },
  }).select("_id").lean();
  if (!course) redirect("/admin/pricing?promo=course");

  await PromoCode.updateOne({ _id: promoCodeId, active: false }, { $set: { active: true } });
  await recordAdminAction({ actorId, action: "pricing.promo-activated", targetType: "promo-code", targetId: promoCodeId });
  revalidatePath("/admin/pricing");
  redirect("/admin/pricing?promo=activated");
}
