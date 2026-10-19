import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SignupCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    encryptedCode: { type: String },
    active: { type: Boolean, required: true, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export type SignupCodeDoc = InferSchemaType<typeof SignupCodeSchema>;

export const SignupCode: Model<SignupCodeDoc> = models.SignupCode || model<SignupCodeDoc>("SignupCode", SignupCodeSchema);