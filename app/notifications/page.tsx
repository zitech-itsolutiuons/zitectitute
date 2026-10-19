import { redirect } from "next/navigation";
import NotificationInbox from "@/components/notifications/NotificationInbox";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/lib/models/LearningFeatures";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  await connectDB();
  const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  const initialItems = notifications.map((item) => ({
    _id: String(item._id),
    type: item.type,
    title: item.title,
    message: item.message,
    href: item.href,
    readAt: item.readAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));
  return (
    <>
      <main className="mx-auto min-h-[70vh] max-w-5xl px-5 py-10 md:px-10 md:py-14">
        <NotificationInbox initialItems={initialItems} />
      </main>
    </>
  );
}
