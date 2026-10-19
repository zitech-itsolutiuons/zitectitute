import Link from "next/link";

export type CourseCategoryOption = { id: string; name: string };

export default function CourseCategorySelect({
  categories,
  id,
  defaultValue = "",
}: {
  categories: CourseCategoryOption[];
  id: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        Course category
      </label>
      <select
        id={id}
        name="categoryId"
        required
        disabled={categories.length === 0}
        defaultValue={defaultValue}
        className="mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
      >
        <option value="" disabled>{categories.length ? "Select a category" : "No categories available"}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
      {categories.length === 0 && (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Create a category before creating a course.{" "}
          <Link href="/admin/categories" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200">
            Manage categories
          </Link>
        </p>
      )}
    </div>
  );
}
