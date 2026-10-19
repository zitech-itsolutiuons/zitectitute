import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CourseAccessGrantSchema = new Schema(
  {
    userId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    source: { type: String, enum: ["paystack", "promo"], required: true },
    amountPaidKobo: { type: Number, required: true, min: 0 },
    paymentReference: { type: String },
    promoCodeId: { type: Schema.Types.ObjectId, ref: "PromoCode" },
  },
  { timestamps: true }
);
CourseAccessGrantSchema.index({ userId: 1, courseId: 1 }, { unique: true });
CourseAccessGrantSchema.index({ paymentReference: 1 }, { unique: true, sparse: true });

const PromoCodeSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    discountPercent: { type: Number, enum: [50, 100], required: true },
    active: { type: Boolean, default: true, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);
PromoCodeSchema.index({ code: 1, courseId: 1 }, { unique: true });

const CoursePaymentSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    amountKobo: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["NGN"], required: true, default: "NGN" },
    status: { type: String, enum: ["pending", "success", "failed"], required: true, default: "pending" },
    promoCodeId: { type: Schema.Types.ObjectId, ref: "PromoCode" },
    accessRevokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type CourseAccessGrantDoc = InferSchemaType<typeof CourseAccessGrantSchema>;
export type PromoCodeDoc = InferSchemaType<typeof PromoCodeSchema>;
export type CoursePaymentDoc = InferSchemaType<typeof CoursePaymentSchema>;

export const CourseAccessGrant: Model<CourseAccessGrantDoc> =
  models.CourseAccessGrant || model<CourseAccessGrantDoc>("CourseAccessGrant", CourseAccessGrantSchema);
export const PromoCode: Model<PromoCodeDoc> = models.PromoCode || model<PromoCodeDoc>("PromoCode", PromoCodeSchema);
export const CoursePayment: Model<CoursePaymentDoc> =
  models.CoursePayment || model<CoursePaymentDoc>("CoursePayment", CoursePaymentSchema);
