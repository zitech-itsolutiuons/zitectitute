import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CohortDiscussionReplySchema = new Schema(
  {
    authorId: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
  },
  { timestamps: true }
);

const CohortDiscussionSchema = new Schema(
  {
    cohortId: { type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    authorId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    replies: { type: [CohortDiscussionReplySchema], default: [] },
  },
  { timestamps: true }
);

CohortDiscussionSchema.index({ cohortId: 1, createdAt: -1 });

export type CohortDiscussionDoc = InferSchemaType<typeof CohortDiscussionSchema>;
export const CohortDiscussion: Model<CohortDiscussionDoc> =
  models.CohortDiscussion || model<CohortDiscussionDoc>("CohortDiscussion", CohortDiscussionSchema);
