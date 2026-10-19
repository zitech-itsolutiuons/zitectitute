import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const AdminAuditLogSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, default: "" },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AdminAuditLogSchema.index({ createdAt: -1 });

export type AdminAuditLogDoc = InferSchemaType<typeof AdminAuditLogSchema>;
export const AdminAuditLog: Model<AdminAuditLogDoc> =
  models.AdminAuditLog || model<AdminAuditLogDoc>("AdminAuditLog", AdminAuditLogSchema);
