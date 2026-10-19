import { randomBytes } from "node:crypto";
import { UserProfile } from "@/lib/models/UserProfile";

function newStudentId() {
  return `STU-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export async function ensureStudentId(userId: string, displayName: string) {
  let profile = await UserProfile.findOne({ userId }).select("studentId").lean();
  if (!profile) {
    try {
      await UserProfile.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, displayName, studentId: newStudentId() } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) throw error;
    }
    profile = await UserProfile.findOne({ userId }).select("studentId").lean();
  }

  if (!profile?.studentId) {
    await UserProfile.findOneAndUpdate(
      { userId, studentId: { $in: ["", null] } },
      { $set: { studentId: newStudentId() } },
      { new: true }
    );
    profile = await UserProfile.findOne({ userId }).select("studentId").lean();
  }

  if (!profile?.studentId) throw new Error(`Student ID could not be assigned for user ${userId}`);
  return profile.studentId;
}
