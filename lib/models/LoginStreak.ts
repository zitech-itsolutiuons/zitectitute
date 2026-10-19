import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const LoginStreakSchema = new Schema(
  {
    accountKey: { type: String, required: true, unique: true, index: true },
    currentStreak: { type: Number, required: true, default: 0, min: 0 },
    longestStreak: { type: Number, required: true, default: 0, min: 0 },
    lastLoginDay: { type: String, required: true },
    recentLoginDays: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type LoginStreakDoc = InferSchemaType<typeof LoginStreakSchema>;
export const LoginStreak: Model<LoginStreakDoc> =
  models.LoginStreak || model<LoginStreakDoc>("LoginStreak", LoginStreakSchema);
