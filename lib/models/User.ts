import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "instructor", "admin"], default: "user", required: true },
    signupCodeId: { type: Schema.Types.ObjectId, ref: "SignupCode", index: true },
    // Brute-force protection (see lib/users.ts)
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    sessionVersion: { type: Number, default: 0 },
    platformRestrictedAt: Date,
    platformRestrictedBy: String,
  },
  { timestamps: true }
);

if (models.User && (
  !models.User.schema.path("role")?.options.enum?.includes("instructor")
  || !models.User.schema.path("platformRestrictedAt")
)) {
  delete models.User;
}

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User: Model<UserDoc> = models.User || model<UserDoc>("User", UserSchema);
