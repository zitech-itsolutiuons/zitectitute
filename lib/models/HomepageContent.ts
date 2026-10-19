import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const HomepageContentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "home" },
    updatedBy: { type: String, required: true },
    heroTitle: { type: String, required: true, trim: true },
    heroDescription: { type: String, required: true, trim: true },
    primaryCta: { type: String, required: true, trim: true },
    secondaryCta: { type: String, required: true, trim: true },
    heroFootnote: { type: String, required: true, trim: true },
    codeExampleLabel: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export type HomepageContentDoc = InferSchemaType<typeof HomepageContentSchema>;

export const HomepageContent: Model<HomepageContentDoc> =
  models.HomepageContent || model<HomepageContentDoc>("HomepageContent", HomepageContentSchema);

export const defaultHomepageContent = {
  heroTitle: "Learn the skills behind the web.",
  heroDescription:
    "Explore instructor-led courses in web design, HTML, CSS, JavaScript, and computer science. Study through clear lessons and practice grounded in your course materials.",
  primaryCta: "Explore courses",
  secondaryCta: "Sign in",
  heroFootnote: "Learn at your pace. Return to your lessons whenever you’re ready.",
  codeExampleLabel: "A first look at HTML",
} as const;

export type HomepageContentValues = typeof defaultHomepageContent;