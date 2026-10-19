import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { SupportConversation, SupportMessage } from "@/lib/models/SupportConversation";
import { User } from "@/lib/models/User";
import { UserProfile } from "@/lib/models/UserProfile";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

const MessageInput = z.object({
  conversationId: z.string().refine(isValidObjectId),
  body: z.string().trim().min(1).max(4000),
});

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) return { error: json({ error: "Sign in required." }, 401) };
  if (!(await isAdmin(userId))) return { error: json({ error: "Administrator access required." }, 403) };
  return { userId };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  await connectDB();

  const conversations = await SupportConversation.find()
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  const userIds = conversations.map((conversation) => conversation.userId);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("name email").lean()
    : [];
  const profiles = userIds.length
    ? await UserProfile.find({ userId: { $in: userIds } }).select("userId avatarData").lean()
    : [];
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const conversationIds = conversations.map((conversation) => conversation._id);
  const recentMessages = conversationIds.length
    ? await SupportMessage.find({ conversationId: { $in: conversationIds } })
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean()
    : [];
  const latestByConversation = new Map<string, (typeof recentMessages)[number]>();
  for (const message of recentMessages) {
    const conversationId = String(message.conversationId);
    if (!latestByConversation.has(conversationId)) latestByConversation.set(conversationId, message);
  }

  const requestedId = new URL(request.url).searchParams.get("conversationId");
  let selected = null;
  if (requestedId) {
    if (!isValidObjectId(requestedId)) return json({ error: "Choose a valid conversation." }, 400);
    const conversation = conversations.find((item) => String(item._id) === requestedId);
    if (!conversation) return json({ error: "Conversation not found." }, 404);
    const readAt = new Date();
    await SupportConversation.updateOne(
      { _id: conversation._id },
      { $set: { lastAdminReadAt: readAt } }
    );
    const messages = await SupportMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    selected = {
      id: String(conversation._id),
      userId: conversation.userId,
      userAvatar: profileByUserId.get(conversation.userId)?.avatarData ?? "",
      messages: messages.reverse().map((message) => ({
        id: String(message._id),
        authorRole: message.authorRole,
        body: message.body,
        createdAt: message.createdAt,
      })),
    };
  }

  return json({
    conversations: conversations.map((conversation) => {
      const user = userById.get(conversation.userId);
      const latest = latestByConversation.get(String(conversation._id));
      return {
        id: String(conversation._id),
        userId: conversation.userId,
        userName: user?.name ?? "Learner",
        userAvatar: profileByUserId.get(conversation.userId)?.avatarData ?? "",
        email: user?.email ?? "",
        updatedAt: conversation.updatedAt,
        unread: Boolean(
          conversation.lastUserMessageAt &&
          (!conversation.lastAdminReadAt || conversation.lastUserMessageAt > conversation.lastAdminReadAt)
        ),
        lastMessage: latest?.body ?? "",
      };
    }),
    selected,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const parsed = MessageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Write a reply of up to 4,000 characters and select a conversation." }, 400);

  await connectDB();
  const conversation = await SupportConversation.findById(parsed.data.conversationId).select("_id").lean();
  if (!conversation) return json({ error: "Conversation not found." }, 404);
  const now = new Date();
  const message = await SupportMessage.create({
    conversationId: conversation._id,
    authorId: auth.userId,
    authorRole: "admin",
    body: parsed.data.body,
  });
  await SupportConversation.updateOne(
    { _id: conversation._id },
    { $set: { lastAdminMessageAt: now, lastAdminReadAt: now } }
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
