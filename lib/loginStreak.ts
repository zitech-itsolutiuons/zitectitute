import { connectDB } from "@/lib/db";
import { LoginStreak } from "@/lib/models/LoginStreak";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function recordLoginStreak(accountKey: string, now = new Date()): Promise<void> {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const alreadyRecordedOrNewer = {
    $gte: ["$lastLoginDay", { $literal: today }],
  };
  const currentStreak = {
    $cond: [
      alreadyRecordedOrNewer,
      { $ifNull: ["$currentStreak", 0] },
      {
        $cond: [
          { $eq: ["$lastLoginDay", { $literal: yesterday }] },
          { $add: [{ $ifNull: ["$currentStreak", 0] }, 1] },
          1,
        ],
      },
    ],
  };
  const update = [
    {
      $set: {
        accountKey: { $literal: accountKey },
        currentStreak,
        longestStreak: {
          $cond: [
            alreadyRecordedOrNewer,
            { $ifNull: ["$longestStreak", 0] },
            { $max: [{ $ifNull: ["$longestStreak", 0] }, currentStreak] },
          ],
        },
        lastLoginDay: {
          $cond: [alreadyRecordedOrNewer, "$lastLoginDay", { $literal: today }],
        },
        recentLoginDays: {
          $cond: [
            alreadyRecordedOrNewer,
            { $ifNull: ["$recentLoginDays", []] },
            {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ["$recentLoginDays", []] },
                    [{ $literal: today }],
                  ],
                },
                -7,
              ],
            },
          ],
        },
      },
    },
  ];

  await connectDB();
  try {
    await LoginStreak.updateOne({ accountKey }, update, { upsert: true });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
    await LoginStreak.updateOne({ accountKey }, update);
  }
}
