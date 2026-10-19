"use client";

import { useState } from "react";

type CohortOption = { id: string; name: string };

export default function BulkStudentImportForm({ cohorts }: { cohorts: CohortOption[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/users/import", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "The import failed.");
      }
      const csv = await response.blob();
      const url = URL.createObjectURL(csv);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student-import-results.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${response.headers.get("X-Import-Created") ?? "0"} accounts created; ${response.headers.get("X-Import-Skipped") ?? "0"} rows skipped. Downloaded the results and temporary passwords.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-3xl space-y-5 border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <label className="block text-sm font-medium text-slate-700">
        Student CSV
        <input name="file" type="file" accept=".csv,text/csv" required className="mt-2 block min-h-11 w-full border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Add new accounts to a cohort <span className="font-normal text-slate-500">(optional)</span>
        <select name="cohortId" defaultValue="" className="mt-2 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Do not add to a cohort</option>
          {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
        </select>
      </label>
      <p className="text-xs leading-5 text-slate-500">Required columns: <code>name,email</code>. Optional: <code>studentId,program,level</code>. Maximum 500 students per import. Existing accounts and invalid rows are skipped.</p>
      <p className="text-xs leading-5 text-amber-800">The downloaded results include temporary passwords for newly created users. Store and share that file securely; it is not retained by the app.</p>
      {error && <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <button type="submit" disabled={busy} className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        {busy ? "Importing students…" : "Import students"}
      </button>
    </form>
  );
}
