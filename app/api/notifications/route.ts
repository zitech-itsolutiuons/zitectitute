import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Notification } from "@/lib/models/LearningFeatures";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

const UpdateInput = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
}).refine((value) => Boolean(value.id) !== Boolean(value.markAllRead), {
  message: "Choose one notification or mark all notifications as read.",
});

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  await connectDB();
  if (new URL(request.url).searchParams.get("count") === "1") {
    const unreadCount = await Notification.countDocuments({ userId, readAt: null });
    return json({ unreadCount });
  }
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean(),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const parsed = UpdateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.id && !isValidObjectId(parsed.data.id))) {
    return json({ error: "Choose a valid notification to update." }, 400);
  }
  await connectDB();
  if (parsed.data.markAllRead) {
    await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  } else {
    const result = await Notification.updateOne(
      { _id: parsed.data.id, userId },
      { $set: { readAt: new Date() } }
    );
    if (result.matchedCount === 0) return json({ error: "Notification not found" }, 404);
  }
  return json({ ok: true });
}
