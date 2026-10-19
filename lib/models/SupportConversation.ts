import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SupportConversationSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    lastUserMessageAt: { type: Date, default: null },
    lastAdminMessageAt: { type: Date, default: null },
    lastUserReadAt: { type: Date, default: null },
    lastAdminReadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SupportMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "SupportConversation", required: true },
    authorId: { type: String, required: true },
    authorRole: { type: String, enum: ["user", "admin"], required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

SupportMessageSchema.index({ conversationId: 1, createdAt: 1 });

export type SupportConversationDoc = InferSchemaType<typeof SupportConversationSchema>;
export type SupportMessageDoc = InferSchemaType<typeof SupportMessageSchema>;

export const SupportConversation: Model<SupportConversationDoc> =
  models.SupportConversation || model<SupportConversationDoc>("SupportConversation", SupportConversationSchema);
export const SupportMessage: Model<SupportMessageDoc> =
  models.SupportMessage || model<SupportMessageDoc>("SupportMessage", SupportMessageSchema);
