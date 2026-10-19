import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CohortActivitySessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    cohortIds: [{ type: Schema.Types.ObjectId, ref: "Cohort" }],
    startedAt: { type: Date, required: true, default: Date.now },
    lastSeenAt: { type: Date, required: true, default: Date.now },
    activeSeconds: { type: Number, default: 0, min: 0 },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CohortActivitySessionSchema.index({ cohortIds: 1, lastSeenAt: -1 });
CohortActivitySessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type CohortActivitySessionDoc = InferSchemaType<typeof CohortActivitySessionSchema>;
export const CohortActivitySession: Model<CohortActivitySessionDoc> =
  models.CohortActivitySession ||
  model<CohortActivitySessionDoc>("CohortActivitySession", CohortActivitySessionSchema);
