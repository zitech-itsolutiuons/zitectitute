import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { Announcement, Notification } from "@/lib/models/LearningFeatures";
import { User } from "@/lib/models/User";
import { z } from "zod";

const AnnouncementInput = z.object({
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(10_000),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  if (!(await isAdmin(userId))) return json({ error: "Administrator access required" }, 403);
  await connectDB();
  const announcements = await Announcement.find().sort({ publishedAt: -1 }).limit(100).lean();
  return json({ announcements });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  if (!(await isAdmin(userId))) return json({ error: "Administrator access required" }, 403);
  const parsed = AnnouncementInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Add a title and message to publish the announcement." }, 400);

  await connectDB();
  const announcement = await Announcement.create({ ...parsed.data, publishedBy: userId });
  let learnerCount = 0;
  let operations: Parameters<typeof Notification.bulkWrite>[0] = [];
  const learners = User.find({ role: "user" }).select("_id").lean().cursor({ batchSize: 500 });
  for await (const learner of learners) {
    const learnerId = String(learner._id);
    operations.push({
      updateOne: {
        filter: { userId: learnerId, eventKey: `announcement:${announcement._id}` },
        update: {
          $setOnInsert: {
            userId: learnerId,
            type: "announcement",
            title: parsed.data.title,
            message: parsed.data.message,
            href: "/notifications",
            eventKey: `announcement:${announcement._id}`,
          },
        },
        upsert: true,
      },
    });
    learnerCount += 1;
    if (operations.length === 500) {
      await Notification.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }
  if (operations.length > 0) await Notification.bulkWrite(operations, { ordered: false });
  await recordAdminAction({
    actorId: userId,
    action: "announcement.published",
    targetType: "announcement",
    targetId: String(announcement._id),
    details: { learnerCount },
  });
  return json({ ok: true, learnerCount }, 201);
}
