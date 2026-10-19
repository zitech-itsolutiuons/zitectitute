import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import SiteHeader from "@/components/SiteHeader";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { SupportConversation } from "@/lib/models/SupportConversation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  await connectDB();
  const supportUnreadCount = await SupportConversation.countDocuments({
    $expr: { $gt: ["$lastUserMessageAt", { $ifNull: ["$lastAdminReadAt", new Date(0)] }] },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16 sm:pt-8 lg:px-10">
        <div className="mb-6 flex min-w-0 flex-col justify-between gap-4 border-b border-[#d9d5ca] pb-6 sm:flex-row sm:items-end sm:gap-5 sm:pb-7 dark:border-[#394941]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#456b55] dark:text-[#b5c9b5]">Zitectitute / Administration</p>
            <h1 className="mt-2 font-serif text-2xl font-semibold text-[#26312d] sm:text-3xl dark:text-[#f2eee4]">Admin workspace</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Manage courses, learners and the platform from one place.</p>
          </div>
          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-md border border-[#d3dfd2] bg-[#e9f0e8] px-3 py-2 text-xs font-semibold text-[#355f4c] dark:border-[#44604b] dark:bg-[#24372b] dark:text-[#c9dfcb]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#4c805a]" />
            Admin access
          </div>
        </div>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          <AdminNav supportUnreadCount={supportUnreadCount} />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </>
  );
}