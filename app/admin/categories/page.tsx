import {
  createCourseCategoryAction,
  deleteCourseCategoryAction,
  renameCourseCategoryAction,
} from "@/app/admin/categories/actions";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";

export const dynamic = "force-dynamic";

const fieldClass = "mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const notices: Record<string, { message: string; isError?: boolean }> = {
  created: { message: "Category created." },
  renamed: { message: "Category renamed." },
  deleted: { message: "Category deleted." },
  duplicate: { message: "A category with that name already exists.", isError: true },
  invalid: { message: "Enter a valid category name and try again.", isError: true },
  missing: { message: "That category no longer exists. Refresh the page and try again.", isError: true },
  "in-use": { message: "Reassign courses to another category before deleting this one.", isError: true },
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await connectDB();
  const [categories, usageRows] = await Promise.all([
    CourseCategory.find().sort({ name: 1 }).select("name slug").lean(),
    Course.aggregate([
      { $match: { categoryId: { $ne: null } } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]) as Promise<{ _id: unknown; count: number }[]>,
  ]);
  const courseCounts = new Map(usageRows.map((row) => [String(row._id), row.count]));
  const notice = notices[(await searchParams).notice ?? ""];

  return (
    <section aria-labelledby="categories-heading" className="space-y-7">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h2 id="categories-heading" className="text-xl font-semibold text-slate-950 dark:text-white">Course categories</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Create and maintain the categories learners can browse on the homepage. Assign one category to every course when you create it.
        </p>
      </header>

      {notice && (
        <p role={notice.isError ? "alert" : "status"} className={`border px-4 py-3 text-sm ${notice.isError ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}>
          {notice.message}
        </p>
      )}

      <form action={createCourseCategoryAction} className="grid gap-4 border-y border-slate-200 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end dark:border-slate-800">
        <label htmlFor="new-category-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          New category name
          <input id="new-category-name" name="name" required maxLength={80} className={fieldClass} placeholder="For example, Web development" />
        </label>
        <button type="submit" className="min-h-11 border border-emerald-900 bg-emerald-900 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 dark:border-emerald-200 dark:bg-emerald-200 dark:text-emerald-950 dark:hover:bg-emerald-100">
          Add category
        </button>
      </form>

      {categories.length ? (
        <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {categories.map((category) => {
            const id = String(category._id);
            const courseCount = courseCounts.get(id) ?? 0;
            return (
              <li key={id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <form action={renameCourseCategoryAction} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <input type="hidden" name="categoryId" value={id} />
                  <label htmlFor={`category-${id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Category name
                    <input id={`category-${id}`} name="name" required maxLength={80} defaultValue={category.name} className={fieldClass} />
                    <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                      {courseCount} {courseCount === 1 ? "course assigned" : "courses assigned"}
                    </span>
                  </label>
                  <button type="submit" className="min-h-11 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                    Save name
                  </button>
                </form>
                <form action={deleteCourseCategoryAction}>
                  <input type="hidden" name="categoryId" value={id} />
                  <button
                    type="submit"
                    disabled={courseCount > 0}
                    className="min-h-11 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-900 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-rose-300 dark:hover:bg-rose-950/50 dark:disabled:text-rose-200"
                    title={courseCount > 0 ? "Reassign courses before deleting this category." : undefined}
                  >
                    Delete
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border-y border-slate-200 py-7 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          No categories yet. Add a category before creating or publishing courses.
        </p>
      )}
    </section>
  );
}
