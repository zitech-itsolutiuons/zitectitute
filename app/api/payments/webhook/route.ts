import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyAndGrantCourseAccess } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });

  const signature = request.headers.get("x-paystack-signature");
  const body = await request.text();
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  const expected = createHmac("sha512", secret).update(body).digest();
  const supplied = Buffer.from(signature, "hex");
  if (!timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (
    typeof event !== "object" ||
    event === null ||
    !("event" in event) ||
    event.event !== "charge.success" ||
    !("data" in event) ||
    typeof event.data !== "object" ||
    event.data === null ||
    !("reference" in event.data) ||
    typeof event.data.reference !== "string"
  ) {
    return NextResponse.json({ received: true });
  }

  try {
    await connectDB();
    const result = await verifyAndGrantCourseAccess(event.data.reference);
    if (!result) return NextResponse.json({ error: "Payment reference not found." }, { status: 404 });
    if (result.revoked) return NextResponse.json({ received: true });
    if (!result.paid) return NextResponse.json({ error: "Paystack has not confirmed a successful payment." }, { status: 409 });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[payments] Paystack webhook processing failed", error);
    return NextResponse.json({ error: "Payment verification failed. Paystack may retry this webhook." }, { status: 502 });
  }
}
