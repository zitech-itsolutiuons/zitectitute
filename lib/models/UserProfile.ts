import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const UserProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true },
    studentId: { type: String, default: "", trim: true },
    program: { type: String, default: "", trim: true },
    level: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    avatarData: { type: String, default: "" },
  },
  { timestamps: true }
);

export type UserProfileDoc = InferSchemaType<typeof UserProfileSchema>;
export const UserProfile: Model<UserProfileDoc> = models.UserProfile || model<UserProfileDoc>("UserProfile", UserProfileSchema);