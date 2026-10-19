import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { SupportConversation, SupportMessage } from "@/lib/models/SupportConversation";
import { User } from "@/lib/models/User";
import { isAdmin } from "@/lib/auth";
import { z } from "zod";

const MessageInput = z.object({
  body: z.string().trim().min(1).max(4000),
});

async function requireLearner() {
  const userId = await getUserId();
  if (!userId) return { error: json({ error: "Sign in to contact support." }, 401) };
  if (await isAdmin(userId)) return { error: json({ error: "Use the admin support inbox." }, 403) };
  return { userId };
}

export async function GET() {
  const auth = await requireLearner();
  if (auth.error) return auth.error;
  await connectDB();
  const conversation = await SupportConversation.findOne({ userId: auth.userId }).lean();
  if (!conversation) return json({ conversationId: null, messages: [] });

  const readAt = new Date();
  await SupportConversation.updateOne(
    { _id: conversation._id, userId: auth.userId },
    { $set: { lastUserReadAt: readAt } }
  );
  const messages = await SupportMessage.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  return json({
    conversationId: String(conversation._id),
    messages: messages.reverse().map((message) => ({
      id: String(message._id),
      authorRole: message.authorRole,
      body: message.body,
      createdAt: message.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireLearner();
  if (auth.error) return auth.error;
  const parsed = MessageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Write a message of up to 4,000 characters." }, 400);

  await connectDB();
  const user = await User.findById(auth.userId).select("role").lean();
  if (!user || user.role === "admin") return json({ error: "Support is unavailable for this account." }, 403);

  let conversation = await SupportConversation.findOne({ userId: auth.userId }).select("_id").lean();
  if (!conversation) {
    try {
      conversation = await SupportConversation.create({ userId: auth.userId });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      conversation = await SupportConversation.findOne({ userId: auth.userId }).select("_id").lean();
      if (!conversation) throw error;
    }
  }

  const now = new Date();
  const message = await SupportMessage.create({
    conversationId: conversation._id,
    authorId: auth.userId,
    authorRole: "user",
    body: parsed.data.body,
  });
  await SupportConversation.updateOne(
    { _id: conversation._id },
    { $set: { lastUserMessageAt: now, lastUserReadAt: now } }
  );
  return json({
    message: {
      id: String(message._id),
      authorRole: message.authorRole,
      body: message.body,
      createdAt: message.createdAt,
    },
  }, 201);
}
