import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { SupportConversation } from "@/lib/models/SupportConversation";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  await connectDB();
  const admin = await isAdmin(userId);
  const unreadCount = admin
    ? await SupportConversation.countDocuments({
        $expr: { $gt: ["$lastUserMessageAt", { $ifNull: ["$lastAdminReadAt", new Date(0)] }] },
      })
    : await SupportConversation.countDocuments({
        userId,
        $expr: { $gt: ["$lastAdminMessageAt", { $ifNull: ["$lastUserReadAt", new Date(0)] }] },
      });
  return json({ unreadCount });
}
