import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const PlatformSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "platform" },
    requireSignupCode: { type: Boolean, required: true, default: true },
    studentQuizQuestionLimit: { type: Number, required: true, min: 1, max: 15, default: 15 },
    achievementBadgesEnabled: { type: Boolean, required: true, default: false },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export type PlatformSettingsDoc = InferSchemaType<typeof PlatformSettingsSchema>;

if (
  models.PlatformSettings &&
  !models.PlatformSettings.schema.path("achievementBadgesEnabled")
) {
  delete models.PlatformSettings;
}

export const PlatformSettings: Model<PlatformSettingsDoc> =
  models.PlatformSettings || model<PlatformSettingsDoc>("PlatformSettings", PlatformSettingsSchema);