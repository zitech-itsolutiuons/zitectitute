import AnnouncementsManager from "@/components/admin/AnnouncementsManager";

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-7">
      <div className="border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.025em] text-[#26312d] dark:text-[#f2eee4]">Announcements</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Share important updates with learners and review what has been published.</p>
      </div>
      <AnnouncementsManager />
    </div>
  );
}
