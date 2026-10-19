import SupportInbox from "@/components/admin/SupportInbox";

export const dynamic = "force-dynamic";

export default function AdminSupportPage() {
  return (
    <section aria-labelledby="support-heading" className="space-y-5">
      <header className="border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
        <h2 id="support-heading" className="font-serif text-2xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Support inbox</h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">Reply to learner messages. Replies appear in the learner’s support area and remain there until they sign in to read them.</p>
      </header>
      <SupportInbox />
    </section>
  );
}
