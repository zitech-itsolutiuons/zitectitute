import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LearnerWorkspaceLayout from "@/components/LearnerWorkspaceLayout";
import SupportChat, { type SupportMessageView } from "@/components/support/SupportChat";
import { connectDB } from "@/lib/db";
import { SupportConversation, SupportMessage } from "@/lib/models/SupportConversation";
import { UserProfile } from "@/lib/models/UserProfile";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role === "admin") redirect("/admin/support");
  await connectDB();
  const profile = await UserProfile.findOne({ userId: session.user.id }).select("displayName avatarData").lean();
  const conversation = await SupportConversation.findOne({ userId: session.user.id }).select("_id").lean();
  let initialMessages: SupportMessageView[] = [];
  if (conversation) {
    await SupportConversation.updateOne({ _id: conversation._id }, { $set: { lastUserReadAt: new Date() } });
    const messages = await SupportMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).limit(500).lean();
    initialMessages = messages.map((message) => ({
      id: String(message._id),
      authorRole: message.authorRole,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }));
  }

  return (
    <LearnerWorkspaceLayout>
      <main className="mx-auto w-full max-w-4xl space-y-7">
        <header className="border-b border-[#d9d5ca] pb-5 dark:border-[#394941]">
          <h1 className="font-serif text-3xl font-semibold text-[#26312d] dark:text-[#f2eee4]">Support</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#59685e] dark:text-[#c0c8bf]">
            Send a message to the support team. Replies will stay here, including while you are signed out.
          </p>
        </header>
        <SupportChat
          initialMessages={initialMessages}
          userName={profile?.displayName || session.user.name || "You"}
          avatarData={profile?.avatarData ?? ""}
        />
      </main>
    </LearnerWorkspaceLayout>
  );
}
