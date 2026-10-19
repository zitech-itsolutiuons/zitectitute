import { connectDB } from "@/lib/db";
import { defaultHomepageContent, HomepageContent } from "@/lib/models/HomepageContent";
import { saveHomepageContent } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const fieldClass = "mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";

const notices: Record<string, string> = {
  saved: "Homepage changes saved.",
  invalid: "Check that every field is filled in and within its character limit.",
};

function TextField({ name, label, value, maxLength }: { name: string; label: string; value: string; maxLength: number }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input name={name} required maxLength={maxLength} defaultValue={value} className={fieldClass} />
    </label>
  );
}

function TextArea({ name, label, value, maxLength, rows = 3 }: { name: string; label: string; value: string; maxLength: number; rows?: number }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea name={name} required maxLength={maxLength} rows={rows} defaultValue={value} className={`${fieldClass} resize-y`} />
    </label>
  );
}

export default async function AdminHomepagePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connectDB();
  const savedContent = await HomepageContent.findOne({ key: "home" }).lean();
  const content = savedContent ? { ...defaultHomepageContent, ...savedContent } : defaultHomepageContent;
  const notice = notices[(await searchParams).notice ?? ""];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Home page content</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Update the homepage hero message and code-example label. The course catalog and product feature sections describe current platform capabilities.
        </p>
      </div>

      {notice && (
        <p role="status" className={`border px-4 py-3 text-sm ${notice.startsWith("Homepage") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {notice}
        </p>
      )}

      <form action={saveHomepageContent} className="space-y-9">
        <section className="grid gap-5 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Hero</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The main message and actions visitors see first.</p>
          </div>
          <div className="grid gap-4">
            <TextField name="heroTitle" label="Heading" value={content.heroTitle} maxLength={120} />
            <TextArea name="heroDescription" label="Description" value={content.heroDescription} maxLength={1000} rows={4} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="primaryCta" label="Primary button label" value={content.primaryCta} maxLength={60} />
              <TextField name="secondaryCta" label="Secondary button label" value={content.secondaryCta} maxLength={60} />
            </div>
            <p className="text-xs leading-5 text-slate-500">The primary button opens the published course list. The secondary button opens sign-in.</p>
            <TextField name="heroFootnote" label="Short note below the buttons" value={content.heroFootnote} maxLength={200} />
          </div>
        </section>

        <section className="grid gap-5 border-b border-slate-200 pb-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Code example</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The label above the HTML example in the hero.</p>
          </div>
          <TextField name="codeExampleLabel" label="Example label" value={content.codeExampleLabel} maxLength={80} />
        </section>

        <div className="flex flex-wrap items-center justify-end gap-4">
          <a href="/" target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:text-blue-900">
            Preview home page
          </a>
          <button type="submit" className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Save home page
          </button>
        </div>
      </form>
    </div>
  );
}