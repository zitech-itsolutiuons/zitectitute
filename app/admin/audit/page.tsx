import { connectDB } from "@/lib/db";
import { AdminAuditLog } from "@/lib/models/AdminAuditLog";
import { User } from "@/lib/models/User";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connectDB();
  const pageSize = 200;
  const params = await searchParams;
  const parsedPage = Number(params.page);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const totalEvents = await AdminAuditLog.countDocuments();
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const events = await AdminAuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();
  const actorIds = [...new Set(events.map((event) => event.actorId))];
  const users = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select("name email").lean() : [];
  const labels = new Map(users.map((user) => [String(user._id), `${user.name} · ${user.email}`]));
  const backupReady = Boolean(process.env.BACKUP_ENCRYPTION_KEY && process.env.BACKUP_ENCRYPTION_KEY.length >= 32);
  return (
    <section aria-labelledby="audit-heading" className="space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <h2 id="audit-heading" className="text-xl font-semibold text-slate-950">Audit logs and database backup</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Administrator changes, report exports, and backup requests are recorded here. Passwords and imported temporary credentials are never written to the audit log.</p>
      </header>
      <section aria-labelledby="backup-heading" className="max-w-3xl border border-slate-200 bg-white p-5">
        <h3 id="backup-heading" className="font-semibold text-slate-900">Encrypted backup</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Download a compressed, AES-256-GCM encrypted snapshot of MongoDB collections in Extended JSON format. Keep the encryption key and downloaded archive in separate secure locations.</p>
        <p className={`mt-3 text-sm font-medium ${backupReady ? "text-emerald-700" : "text-amber-800"}`}>
          {backupReady ? "Backup encryption is configured." : "Configure BACKUP_ENCRYPTION_KEY (at least 32 characters) on the server before creating a backup."}
        </p>
        <a href="/api/admin/backups" className={`mt-4 inline-flex min-h-11 items-center border px-5 text-sm font-semibold ${backupReady ? "border-blue-700 bg-blue-700 text-white hover:bg-blue-800" : "pointer-events-none border-slate-300 bg-slate-100 text-slate-400"}`} aria-disabled={!backupReady}>
          Download encrypted backup
        </a>
        <p className="mt-3 text-xs leading-5 text-slate-500">Backups are capped at 512 MB uncompressed. A large database must be split or backed up through your database provider’s managed backup service.</p>
      </section>
      <section aria-labelledby="events-heading">
        <div className="mb-3 flex items-end justify-between border-b border-slate-200 pb-3">
          <div><h3 id="events-heading" className="text-lg font-semibold text-slate-900">Administrator activity</h3><p className="mt-1 text-sm text-slate-500">Showing up to 200 events per page.</p></div>
          <span className="text-sm tabular-nums text-slate-500">{totalEvents.toLocaleString()} events · page {page} of {totalPages}</span>
        </div>
        {events.length ? (
          <div className="overflow-x-auto border-y border-slate-200">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Administrator</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={String(event._id)}>
                    <td className="whitespace-nowrap px-3 py-3">{event.createdAt.toLocaleString()}</td>
                    <td className="px-3 py-3">{labels.get(event.actorId) ?? event.actorId}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{event.action}</td>
                    <td className="px-3 py-3">{event.targetType}{event.targetId ? <span className="block font-mono text-xs text-slate-500">{event.targetId}</span> : null}</td>
                    <td className="max-w-sm break-words px-3 py-3 text-xs text-slate-600">{JSON.stringify(event.details ?? {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="border-y border-slate-200 py-7 text-sm text-slate-500">No administrator activity recorded yet.</p>}
        {totalPages > 1 && (
          <nav aria-label="Audit log pages" className="flex justify-between pt-4">
            {page > 1 ? <a href={`/admin/audit?page=${page - 1}`} className="text-sm font-medium text-blue-700 hover:text-blue-900">Previous page</a> : <span />}
            {page < totalPages ? <a href={`/admin/audit?page=${page + 1}`} className="text-sm font-medium text-blue-700 hover:text-blue-900">Next page</a> : <span />}
          </nav>
        )}
      </section>
    </section>
  );
}
