import { connectDB } from "@/lib/db";
import { Cohort } from "@/lib/models/Cohort";
import BulkStudentImportForm from "@/components/admin/BulkStudentImportForm";

export const dynamic = "force-dynamic";

export default async function StudentImportPage() {
  await connectDB();
  const cohorts = await Cohort.find().sort({ name: 1 }).select("name").lean();
  return (
    <section aria-labelledby="student-import-heading" className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="student-import-heading" className="text-xl font-semibold text-slate-950">Bulk student import</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Create learner accounts from a CSV. Each new account receives a random temporary password in a one-time download.</p>
      </header>
      <BulkStudentImportForm cohorts={cohorts.map((cohort) => ({ id: String(cohort._id), name: cohort.name }))} />
    </section>
  );
}
