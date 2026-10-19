import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CoursePayment } from "@/lib/models/CourseCommerce";
import { verifyAndGrantCourseAccess } from "@/lib/payments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  if (!reference || reference.length > 100) {
    return NextResponse.redirect(new URL("/courses?payment=failed", url));
  }

  await connectDB();
  const payment = await CoursePayment.findOne({ reference }).select("courseId").lean();
  if (!payment) return NextResponse.redirect(new URL("/courses?payment=failed", url));

  try {
    const result = await verifyAndGrantCourseAccess(reference);
    const status = result?.revoked ? "access-revoked" : result?.paid ? "success" : "failed";
    return NextResponse.redirect(new URL(`/courses/${payment.courseId}?payment=${status}`, url));
  } catch (error) {
    console.error("[payments] Could not verify the returning course payment", error);
    return NextResponse.redirect(new URL(`/courses/${payment.courseId}?payment=verification-pending`, url));
  }
}
