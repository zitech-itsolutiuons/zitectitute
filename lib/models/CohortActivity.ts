import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const cohortActivityTypes = [
  "signed-in",
  "signed-out",
  "course-opened",
  "lesson-opened",
  "quiz-submitted",
  "final-assessment-submitted",
  "discussion-started",
  "discussion-replied",
] as const;

const CohortActivitySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    cohortIds: [{ type: Schema.Types.ObjectId, ref: "Cohort", required: true }],
    sessionId: { type: String, default: "" },
    type: { type: String, enum: cohortActivityTypes, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", default: null },
    label: { type: String, required: true, maxlength: 180 },
  },
  { timestamps: true }
);

CohortActivitySchema.index({ cohortIds: 1, createdAt: -1 });
CohortActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type CohortActivityDoc = InferSchemaType<typeof CohortActivitySchema>;
export const CohortActivity: Model<CohortActivityDoc> =
  models.CohortActivity || model<CohortActivityDoc>("CohortActivity", CohortActivitySchema);
