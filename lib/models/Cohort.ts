import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CohortSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    memberUserIds: { type: [String], default: [] },
    courseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export type CohortDoc = InferSchemaType<typeof CohortSchema>;
export const Cohort: Model<CohortDoc> = models.Cohort || model<CohortDoc>("Cohort", CohortSchema);
