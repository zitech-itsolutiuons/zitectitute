import { randomUUID } from "node:crypto";
import { isValidObjectId } from "mongoose";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Course, CourseRestriction } from "@/lib/models/Course";
import { CourseAccessGrant, CoursePayment, PromoCode } from "@/lib/models/CourseCommerce";
import { User } from "@/lib/models/User";
import { grantPromoCourseAccess } from "@/lib/payments";
import { z } from "zod";

export const runtime = "nodejs";

const CheckoutBody = z.object({
  courseId: z.string().refine(isValidObjectId),
  promoCode: z.string().trim().max(32).optional().default(""),
});

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in to purchase this course." }, 401);

  const body = CheckoutBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "Choose a valid course." }, 400);
  await connectDB();

  const { courseId, promoCode: rawCode } = body.data;
  const course = await Course.findOne({ _id: courseId, status: "ready", archivedAt: null })
    .select("ownerId instructorId title priceKobo")
    .lean();
  if (!course) return json({ error: "This course is not available for purchase." }, 404);
  if (course.ownerId === userId || course.instructorId === userId)
    return json({ error: "You already have instructor access to this course." }, 409);
  if (await CourseRestriction.exists({ userId, courseId })) return json({ error: "Access to this course is restricted." }, 403);
  if (await CourseAccessGrant.exists({ userId, courseId })) return json({ error: "You already have access to this course." }, 409);
  if (!Number.isSafeInteger(course.priceKobo) || !course.priceKobo || course.priceKobo < 100) {
    return json({ error: "This course is locked until an administrator sets its price." }, 409);
  }

  const user = await User.findById(userId).select("name email").lean();
  if (!user) return json({ error: "Your account could not be found." }, 401);

  const normalizedCode = rawCode.toUpperCase();
  let promo = null;
  if (normalizedCode) {
    promo = await PromoCode.findOne({ courseId, code: normalizedCode, active: true }).lean();
    if (!promo) return json({ error: "That promo code is invalid for this course." }, 400);
  }

  if (promo?.discountPercent === 100) {
    await grantPromoCourseAccess({ userId, courseId, promoCodeId: String(promo._id) });
    return json({ redirectUrl: `/courses/${courseId}` });
  }

  const amountKobo = promo ? Math.round(course.priceKobo * (100 - promo.discountPercent) / 100) : course.priceKobo;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return json({ error: "Payments are not configured yet. Please contact the course administrator." }, 503);

  const reference = `cc_${randomUUID().replaceAll("-", "")}`;
  const payment = await CoursePayment.create({
    reference,
    userId,
    courseId,
    amountKobo,
    currency: "NGN",
    status: "pending",
    ...(promo ? { promoCodeId: promo._id } : {}),
  });

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: new URL("/api/payments/callback", request.url).toString(),
        metadata: { courseId, userId },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const result: unknown = await response.json().catch(() => null);
    const authorizationUrl =
      typeof result === "object" &&
      result !== null &&
      "data" in result &&
      typeof result.data === "object" &&
      result.data !== null &&
      "authorization_url" in result.data &&
      typeof result.data.authorization_url === "string"
        ? result.data.authorization_url
        : null;
    if (
      !response.ok ||
      typeof result !== "object" ||
      result === null ||
      !("status" in result) ||
      result.status !== true ||
      !("data" in result) ||
      typeof result.data !== "object" ||
      result.data === null ||
      !("authorization_url" in result.data) ||
      typeof result.data.authorization_url !== "string" ||
      !authorizationUrl ||
      new URL(authorizationUrl).hostname !== "checkout.paystack.com" ||
      new URL(authorizationUrl).protocol !== "https:"
    ) {
      console.error("[payments] Paystack could not initialize a course payment", { status: response.status, reference });
      return json({ error: "Paystack could not start your payment. Please try again." }, 502);
    }
    return json({ authorizationUrl });
  } catch (error) {
    console.error("[payments] Course payment initialization failed", error);
    return json({ error: "Paystack could not start your payment. Please try again." }, 502);
  }
}
