import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { CourseAccessGrant, PromoCode } from "@/lib/models/CourseCommerce";
import { formatNaira } from "@/lib/currency";
import {
  activatePromoCodeAction,
  createPromoCodeAction,
  deactivatePromoCodeAction,
  saveCoursePriceAction,
} from "./actions";

export const dynamic = "force-dynamic";

const priceMessages: Record<string, string> = {
  saved: "Course price saved.",
  "save-failed": "The price could not be saved. Refresh the page and try again.",
  invalid: "Enter a price of at least ₦1.00, with up to two decimal places.",
  missing: "That active course could not be found.",
};
const promoMessages: Record<string, string> = {
  created: "Promo code created.",
  deactivated: "Promo code deactivated.",
  activated: "Promo code reactivated.",
  duplicate: "That code already exists for this course.",
  invalid: "Enter a valid code and choose a 50% or 100% discount.",
  course: "Promo codes require a ready, active course with a price set. Set the price and publish the course first.",
  missing: "That promo code is already inactive or no longer exists.",
};

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ price?: string; promo?: string }>;
}) {
  await connectDB();
  const [{ price, promo }, courses, promos, redemptions] = await Promise.all([
    searchParams,
    Course.find({ archivedAt: null }).sort({ title: 1 }).select("title status priceKobo catalogVisible").lean(),
    PromoCode.find().sort({ createdAt: -1 }).limit(200).select("courseId code discountPercent active createdAt").lean(),
    CourseAccessGrant.aggregate([
      { $match: { promoCodeId: { $exists: true } } },
      { $group: { _id: "$promoCodeId", count: { $sum: 1 } } },
    ]),
  ]);
  const courseNames = new Map(courses.map((course) => [String(course._id), course.title]));
  const redemptionCounts = new Map(redemptions.map((item: { _id: unknown; count: number }) => [String(item._id), item.count]));
  const purchasableCourses = courses.filter(
    (course) => course.status === "ready" && typeof course.priceKobo === "number" && course.priceKobo >= 100
  );
  const activePromos = promos.filter((item) => item.active).length;
  const paymentConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());

  return (
    <section className="space-y-10" aria-labelledby="pricing-heading">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="pricing-heading" className="text-xl font-semibold text-slate-950">Course pricing and promo codes</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Set a one-time NGN price for each course, then create course-specific discounts. Courses without a price stay locked.
        </p>
      </header>

      <section
        aria-label="Paystack configuration"
        className={`flex flex-col gap-2 border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
          paymentConfigured
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        <p>
          <span className="font-semibold">Paystack:</span>{" "}
          {paymentConfigured
            ? "A server-side secret key is configured. Use a test key for development."
            : "Not configured. Add PAYSTACK_SECRET_KEY to the server environment to accept payments."}
        </p>
        <span className="shrink-0 tabular-nums">{activePromos} active {activePromos === 1 ? "code" : "codes"}</span>
      </section>

      {price && priceMessages[price] && (
        <p role={price === "saved" ? "status" : "alert"} className="border-l-2 border-blue-700 pl-3 text-sm">
          {priceMessages[price]}
        </p>
      )}
      {promo && promoMessages[promo] && (
        <p role={promo === "created" || promo === "deactivated" ? "status" : "alert"} className="border-l-2 border-blue-700 pl-3 text-sm">
          {promoMessages[promo]}
        </p>
      )}

      <section aria-labelledby="course-prices-heading" className="space-y-4">
        <div>
          <h3 id="course-prices-heading" className="text-lg font-semibold text-slate-950">Course prices</h3>
          <p className="mt-1 text-sm text-slate-600">Leave a price blank to lock that course until you set a price.</p>
        </div>
        {courses.length ? (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {courses.map((course) => (
              <li key={String(course._id)} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{course.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {course.status === "ready" ? "Ready for learners" : "Not ready for purchase"}
                    {" · "}
                    {course.catalogVisible ? "Listed in catalogue" : "Invite only"}
                    {" · "}
                    {typeof course.priceKobo === "number" ? formatNaira(course.priceKobo) : "Price not set"}
                  </p>
                </div>
                <form action={saveCoursePriceAction} className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
                  <input type="hidden" name="courseId" value={String(course._id)} />
                  <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                    <label htmlFor={`price-${course._id}`} className="text-xs font-medium text-slate-600">Price in NGN</label>
                    <input
                      id={`price-${course._id}`}
                      name="priceNaira"
                      type="number"
                      min="1"
                      step="0.01"
                      max="999999999"
                      defaultValue={typeof course.priceKobo === "number" ? (course.priceKobo / 100).toFixed(2) : ""}
                      placeholder="e.g. 15000.00"
                      className="mt-1 block min-h-10 w-full border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-slate-700">
                    <input type="checkbox" name="catalogVisible" value="true" defaultChecked={course.catalogVisible} className="h-4 w-4 accent-blue-700" />
                    List in catalogue
                  </label>
                  <button
                    type="submit"
                    className="min-h-10 shrink-0 border border-blue-700 bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    Save price
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-slate-200 py-6 text-sm text-slate-600">No active courses to price.</p>
        )}
      </section>

      <section aria-labelledby="promo-codes-heading" className="space-y-4">
        <div>
          <h3 id="promo-codes-heading" className="text-lg font-semibold text-slate-950">Create a promo code</h3>
          <p className="mt-1 text-sm text-slate-600">Each reusable code works for one course until deactivated. A 50% code discounts checkout; a 100% code grants access immediately.</p>
        </div>
        <form action={createPromoCodeAction} className="grid gap-4 border-y border-slate-200 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
            <div>
              <label htmlFor="promo-course" className="text-sm font-medium">Course</label>
              <select
                id="promo-course"
                name="courseId"
                required
                disabled={!purchasableCourses.length}
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                {purchasableCourses.length ? (
                  purchasableCourses.map((course) => (
                    <option key={String(course._id)} value={String(course._id)}>{course.title}</option>
                  ))
                ) : (
                  <option value="">No ready courses with a price</option>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="promo-code" className="text-sm font-medium">Code</label>
                <input
                  id="promo-code"
                  name="code"
                  required
                  minLength={4}
                  maxLength={32}
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,31}"
                  placeholder="WEB50"
                  className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label htmlFor="promo-discount" className="text-sm font-medium">Discount</label>
                <select id="promo-discount" name="discountPercent" className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 text-sm">
                  <option value="50">50% off</option>
                  <option value="100">100% off</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={!purchasableCourses.length}
              className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Create promo code
            </button>
        </form>
        {!purchasableCourses.length && (
          <p className="text-sm text-slate-600">
            Set a price of at least ₦1.00 on a ready course above. The promo form will unlock when a course qualifies.
          </p>
        )}

        <div>
          <h3 className="text-base font-semibold text-slate-900">Existing codes</h3>
          {promos.length ? (
            <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {promos.map((item) => (
                <li key={String(item._id)} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold tracking-wide text-slate-900">{item.code}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {courseNames.get(String(item.courseId)) ?? "Course removed"}
                      {" · "}{item.discountPercent}% off
                      {" · "}{item.active ? "Active" : "Inactive"}
                      {" · "}{redemptionCounts.get(String(item._id)) ?? 0} redemptions
                    </p>
                  </div>
                  <form action={item.active ? deactivatePromoCodeAction : activatePromoCodeAction}>
                      <input type="hidden" name="promoCodeId" value={String(item._id)} />
                      <button
                        type="submit"
                        className={`min-h-10 border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                          item.active
                            ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                            : "border-blue-700 text-blue-800 hover:bg-blue-50"
                        }`}
                      >
                        {item.active ? "Deactivate" : "Reactivate"}
                      </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No promo codes created yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}
