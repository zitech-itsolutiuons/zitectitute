"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/currency";

type CheckoutResponse = {
  authorizationUrl?: string;
  redirectUrl?: string;
  error?: string;
};

function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("authorizationUrl" in value) || typeof value.authorizationUrl === "string") &&
    (!("redirectUrl" in value) || typeof value.redirectUrl === "string") &&
    (!("error" in value) || typeof value.error === "string")
  );
}

export default function CoursePurchasePanel({
  courseId,
  title,
  description,
  priceKobo,
  paymentStatus,
}: {
  courseId: string;
  title: string;
  description: string;
  priceKobo: number | null;
  paymentStatus?: string;
}) {
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, promoCode: promoCode.trim() }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!isCheckoutResponse(payload) || !response.ok) {
        setError(isCheckoutResponse(payload) ? payload.error || "Checkout could not be started. Please try again." : "Checkout returned an invalid response. Please try again.");
        return;
      }
      const result = payload;
      if (result.redirectUrl) {
        const accessUrl = new URL(result.redirectUrl, window.location.origin);
        if (accessUrl.origin !== window.location.origin || !accessUrl.pathname.startsWith("/courses/")) {
          setError("The course access link was invalid. Please contact the administrator.");
          return;
        }
        window.location.assign(accessUrl);
        return;
      }
      if (!result.authorizationUrl) {
        setError("Paystack did not return a checkout link. Please try again.");
        return;
      }
      const checkoutUrl = new URL(result.authorizationUrl);
      if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.paystack.com") {
        setError("Paystack returned an invalid checkout link. Please contact the administrator.");
        return;
      }
      window.location.assign(checkoutUrl);
    } catch {
      setError("Could not connect to checkout. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="course-purchase" aria-labelledby="purchase-heading">
      <div className="course-purchase__copy">
        <p className="course-purchase__eyebrow">Course access</p>
        <h1 id="purchase-heading">{title}</h1>
        {description && <p className="course-purchase__description">{description}</p>}
        <p className="course-purchase__detail">
          {priceKobo === null
            ? "This course is not available to purchase yet."
            : `One payment unlocks all modules, quizzes, and course tools. Course price: ${formatNaira(priceKobo)}.`}
        </p>
      </div>

      {paymentStatus === "failed" && (
        <p className="course-purchase__message" role="alert">
          Payment was not confirmed. You have not been given course access.
        </p>
      )}
      {paymentStatus === "verification-pending" && (
        <p className="course-purchase__message" role="status">
          We could not confirm the payment yet. Refresh this page shortly to check your course access.
        </p>
      )}
      {paymentStatus === "access-revoked" && (
        <p className="course-purchase__message" role="alert">
          The payment was confirmed, but course access has been revoked. Contact the course administrator if you need help.
        </p>
      )}

      {priceKobo !== null && (
        <form className="course-purchase__form" onSubmit={checkout}>
          <label htmlFor="promoCode" className="text-sm font-medium">Promo code (optional)</label>
          <input
            id="promoCode"
            name="promoCode"
            autoComplete="off"
            maxLength={32}
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            className="mt-2 block w-full border border-blue-200 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            placeholder="Enter a course promo code"
          />
          <p className="mt-2 text-xs text-slate-500">A valid code applies its discount before payment.</p>
          {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 min-h-12 w-full border border-blue-700 bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {pending ? "Preparing checkout…" : "Get course access"}
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">Secure payment by Paystack · NGN</p>
        </form>
      )}
      <Link href="/courses" className="course-purchase__back">Back to courses</Link>
    </section>
  );
}
