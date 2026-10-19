import Link from "next/link";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { updatePlatformAccess, updateUserRole } from "./actions";

export const dynamic = "force-dynamic";

const notices: Record<string, { text: string; tone: string }> = {
  updated: { text: "User role updated.", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  self: { text: "You cannot remove your own administrator access.", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  lastAdmin: { text: "At least one administrator must remain.", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { text: "That account could not be found.", tone: "border-rose-200 bg-rose-50 text-rose-800" },
  notLearner: { text: "Platform restrictions can only be applied to learner accounts.", tone: "border-amber-200 bg-amber-50 text-amber-800" },
  platformRestricted: { text: "Platform access restricted for this learner.", tone: "border-rose-200 bg-rose-50 text-rose-800" },
  platformRestored: { text: "Platform access restored for this learner.", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ notice?: string; q?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const filter = query
    ? { $or: [
        { name: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { email: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ] }
    : {};
  await connectDB();
  const users = await User.find(filter).sort({ createdAt: -1 }).select("name email role createdAt platformRestrictedAt").lean();
  const notice = notices[params.notice ?? ""];

  return (
    <section aria-labelledby="users-heading">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 id="users-heading" className="text-lg font-semibold text-slate-900">All users</h2>
          <p className="mt-1 text-sm text-slate-500">Accounts registered on Zitectitute.</p>
        </div>
        <p className="text-sm tabular-nums text-slate-500">
          {users.length.toLocaleString()} {query ? "matching users" : "total users"}
        </p>
      </div>

      {notice && <p role="status" className={`mb-5 border px-4 py-3 text-sm ${notice.tone}`}>{notice.text}</p>}

      <form method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="user-search" className="sr-only">Search users by name or email</label>
        <input
          id="user-search"
          type="search"
          name="q"
          defaultValue={query}
          maxLength={100}
          placeholder="Search by name or email"
          className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 sm:max-w-sm"
        />
        <button
          type="submit"
          className="min-h-11 border border-blue-700 bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Search
        </button>
        {query && <Link href="/admin/users" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-blue-700 hover:text-blue-900">Clear search</Link>}
      </form>

      {users.length === 0 ? (
        <p className="border-y border-slate-200 py-8 text-sm text-slate-500">
          {query ? "No users match that name or email." : "No users found."}
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3">Platform access</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">User access details</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const userId = String(user._id);
                const restricted = user.role === "user" && Boolean(user.platformRestrictedAt);
                return (
                  <tr key={userId} className="bg-white">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <form action={updateUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={userId} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          aria-label={`Access level for ${user.email}`}
                          className="border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        >
                          <option value="user">User</option>
                          <option value="instructor">Instructor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="submit"
                          className="border border-blue-700 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "user" ? (
                        <form action={updatePlatformAccess} className="flex items-center gap-3">
                          <input type="hidden" name="userId" value={userId} />
                          <input type="hidden" name="mode" value={restricted ? "restore" : "restrict"} />
                          <span className={restricted ? "text-xs font-semibold text-rose-700" : "text-xs font-semibold text-emerald-700"}>
                            {restricted ? "Restricted" : "Active"}
                          </span>
                          <button
                            type="submit"
                            className={restricted
                              ? "whitespace-nowrap text-xs font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                              : "whitespace-nowrap text-xs font-semibold text-rose-700 hover:text-rose-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"}
                          >
                            {restricted ? "Restore" : "Restrict"}
                          </button>
                        </form>
                      ) : <span className="text-xs text-slate-400">Not applicable</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${userId}`} className="whitespace-nowrap font-medium text-blue-700 hover:text-blue-900">
                        User details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}