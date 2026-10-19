import { Notification } from "@/lib/models/LearningFeatures";
import { User } from "@/lib/models/User";

const NOTIFICATION_BATCH_SIZE = 500;

export async function notifyLearnersAboutCourse(courseId: string, courseTitle: string) {
  let operations: Parameters<typeof Notification.bulkWrite>[0] = [];
  const learners = User.find({ role: "user" }).select("_id").lean().cursor({ batchSize: NOTIFICATION_BATCH_SIZE });

  for await (const learner of learners) {
    const userId = String(learner._id);
    operations.push({
      updateOne: {
        filter: { userId, eventKey: `course:${courseId}` },
        update: {
          $setOnInsert: {
            userId,
            type: "course",
            title: "New course available",
            message: `“${courseTitle}” is ready to explore in the course catalogue.`,
            href: `/courses/${courseId}/overview`,
            eventKey: `course:${courseId}`,
          },
        },
        upsert: true,
      },
    });

    if (operations.length === NOTIFICATION_BATCH_SIZE) {
      await Notification.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }

  if (operations.length > 0) await Notification.bulkWrite(operations, { ordered: false });
}
