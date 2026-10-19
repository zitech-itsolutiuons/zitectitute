import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CourseCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

export type CourseCategoryDoc = InferSchemaType<typeof CourseCategorySchema>;

if (models.CourseCategory && !models.CourseCategory.schema.path("slug")) {
  delete models.CourseCategory;
}

export const CourseCategory: Model<CourseCategoryDoc> =
  models.CourseCategory || model<CourseCategoryDoc>("CourseCategory", CourseCategorySchema);
