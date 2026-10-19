import { CourseAccessGrant, CoursePayment } from "@/lib/models/CourseCommerce";
import { Course, StudentProgress } from "@/lib/models/Course";
import { User } from "@/lib/models/User";

type PaystackTransaction = {
  amount: number;
  currency: string;
  reference: string;
  status: string;
};

function paystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return secret;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackTransaction> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    typeof result !== "object" ||
    result === null ||
    !("status" in result) ||
    result.status !== true ||
    !("data" in result) ||
    typeof result.data !== "object" ||
    result.data === null
  ) {
    throw new Error(`Paystack transaction verification failed (${response.status}).`);
  }
  const data = result.data;
  if (
    !("amount" in data) ||
    typeof data.amount !== "number" ||
    !("currency" in data) ||
    typeof data.currency !== "string" ||
    !("reference" in data) ||
    typeof data.reference !== "string" ||
    !("status" in data) ||
    typeof data.status !== "string"
  ) {
    throw new Error("Paystack returned an invalid transaction response.");
  }
  return { amount: data.amount, currency: data.currency, reference: data.reference, status: data.status };
}

async function recordStudentAccess(userId: string, courseId: string) {
  const user = await User.findById(userId).select("name email").lean();
  if (!user) throw new Error("The account for this course payment no longer exists.");
  await StudentProgress.findOneAndUpdate(
    { userId, courseId },
    {
      $set: { displayName: user.name, email: user.email },
      $setOnInsert: { enrolledAt: new Date() },
    },
    { upsert: true }
  );
}

async function grantPaymentAccess(payment: {
  userId: string;
  courseId: unknown;
  amountKobo: number;
  reference: string;
  promoCodeId?: unknown;
}) {
  await CourseAccessGrant.updateOne(
    { userId: payment.userId, courseId: payment.courseId },
    {
      $setOnInsert: {
        source: "paystack",
        amountPaidKobo: payment.amountKobo,
        paymentReference: payment.reference,
        ...(payment.promoCodeId ? { promoCodeId: payment.promoCodeId } : {}),
      },
    },
    { upsert: true }
  );
  await recordStudentAccess(payment.userId, String(payment.courseId));
}

async function grantUnlessRevoked(payment: {
  _id: unknown;
  userId: string;
  courseId: unknown;
  amountKobo: number;
  reference: string;
  promoCodeId?: unknown;
}) {
  if (!(await Course.exists({ _id: payment.courseId }))) return false;
  await grantPaymentAccess(payment);
  const revoked = await CoursePayment.exists({ _id: payment._id, accessRevokedAt: { $ne: null } });
  if (!revoked) return true;

  await CourseAccessGrant.deleteOne({
    userId: payment.userId,
    courseId: payment.courseId,
    paymentReference: payment.reference,
  });
  if (!(await CourseAccessGrant.exists({ userId: payment.userId, courseId: payment.courseId }))) {
    await StudentProgress.deleteOne({ userId: payment.userId, courseId: payment.courseId });
  }
  return false;
}

export async function grantPromoCourseAccess(input: {
  userId: string;
  courseId: string;
  promoCodeId: string;
}) {
  await CourseAccessGrant.updateOne(
    { userId: input.userId, courseId: input.courseId },
    {
      $setOnInsert: {
        source: "promo",
        amountPaidKobo: 0,
        promoCodeId: input.promoCodeId,
      },
    },
    { upsert: true }
  );
  await recordStudentAccess(input.userId, input.courseId);
}

export async function verifyAndGrantCourseAccess(
  reference: string
): Promise<{ courseId: string; paid: boolean; revoked: boolean } | null> {
  const payment = await CoursePayment.findOne({ reference }).lean();
  if (!payment) return null;
  if (payment.accessRevokedAt) return { courseId: String(payment.courseId), paid: false, revoked: true };
  if (payment.status === "success") {
    const granted = await grantUnlessRevoked(payment);
    return { courseId: String(payment.courseId), paid: granted, revoked: !granted };
  }

  const transaction = await verifyPaystackTransaction(reference);
  if (transaction.reference !== reference) throw new Error("Paystack returned a different transaction reference.");
  if (transaction.status !== "success") {
    if (transaction.status === "failed") await CoursePayment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed" } });
    return { courseId: String(payment.courseId), paid: false, revoked: false };
  }
  if (transaction.amount !== payment.amountKobo || transaction.currency !== payment.currency) {
    throw new Error("Paystack transaction amount or currency does not match the course payment.");
  }

  const markedSuccessful = await CoursePayment.updateOne(
    { _id: payment._id, status: "pending", accessRevokedAt: null },
    { $set: { status: "success" } }
  );
  const latestPayment = markedSuccessful.modifiedCount
    ? payment
    : await CoursePayment.findById(payment._id).lean();
  if (!latestPayment) return null;
  if (latestPayment.accessRevokedAt) {
    return { courseId: String(payment.courseId), paid: false, revoked: true };
  }
  if (latestPayment.status !== "success") {
    return { courseId: String(payment.courseId), paid: false, revoked: false };
  }
  const granted = await grantUnlessRevoked(latestPayment);
  return { courseId: String(payment.courseId), paid: granted, revoked: !granted };
}
