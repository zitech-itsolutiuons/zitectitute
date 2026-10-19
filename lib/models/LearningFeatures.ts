import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 10_000 },
    publishedBy: { type: String, required: true, index: true },
    publishedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

const NotificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["announcement", "course", "certificate", "project", "peer-review"], required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 10_000 },
    href: { type: String, required: true, maxlength: 500 },
    eventKey: { type: String, required: true, maxlength: 200 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);
NotificationSchema.index({ userId: 1, eventKey: 1 }, { unique: true });
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

const CertificateSchema = new Schema(
  {
    serial: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    learnerName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    objectiveScore: { type: Number, required: true, min: 0 },
    objectiveTotal: { type: Number, required: true, min: 1 },
    issuedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);
CertificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const CourseProjectSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    instructions: { type: String, default: "", trim: true, maxlength: 20_000 },
    milestones: {
      type: [{ title: { type: String, required: true, trim: true, maxlength: 120 }, description: { type: String, default: "", trim: true, maxlength: 2000 } }],
      default: [],
    },
    rubric: {
      type: [{ criterion: { type: String, required: true, trim: true, maxlength: 160 }, description: { type: String, default: "", trim: true, maxlength: 2000 }, points: { type: Number, required: true, min: 1, max: 100 } }],
      default: [],
    },
    peerReviewEnabled: { type: Boolean, default: false },
    peerReviewerCount: { type: Number, default: 0, min: 0, max: 5 },
    dueAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
CourseProjectSchema.index({ courseId: 1, createdAt: -1 });

const ProjectSubmissionSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "CourseProject", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    userId: { type: String, required: true },
    writtenResponse: { type: String, default: "", maxlength: 20_000 },
    projectLink: { type: String, default: "", maxlength: 2048 },
    completedMilestoneIds: [{ type: Schema.Types.ObjectId }],
    submittedAt: { type: Date, default: null },
    instructorFeedback: { type: String, default: "", maxlength: 10_000 },
    rubricScores: [{ criterionIndex: Number, score: Number, _id: false }],
    gradedBy: { type: String, default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
ProjectSubmissionSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const ProjectSubmissionFileSchema = new Schema(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: "ProjectSubmission", required: true, unique: true },
    filename: { type: String, required: true, maxlength: 180 },
    contentType: { type: String, required: true, maxlength: 100 },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

const ProjectPeerReviewSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "CourseProject", required: true },
    submissionId: { type: Schema.Types.ObjectId, ref: "ProjectSubmission", required: true },
    authorId: { type: String, required: true },
    reviewerId: { type: String, required: true },
    rubricScores: [{ criterionIndex: Number, score: Number, _id: false }],
    feedback: { type: String, default: "", maxlength: 5000 },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
ProjectPeerReviewSchema.index({ submissionId: 1, reviewerId: 1 }, { unique: true });
ProjectPeerReviewSchema.index({ reviewerId: 1, submittedAt: 1 });

export type AnnouncementDoc = InferSchemaType<typeof AnnouncementSchema>;
export type NotificationDoc = InferSchemaType<typeof NotificationSchema>;
export type CertificateDoc = InferSchemaType<typeof CertificateSchema>;
export type CourseProjectDoc = InferSchemaType<typeof CourseProjectSchema>;
export type ProjectSubmissionDoc = InferSchemaType<typeof ProjectSubmissionSchema>;
export type ProjectSubmissionFileDoc = InferSchemaType<typeof ProjectSubmissionFileSchema>;
export type ProjectPeerReviewDoc = InferSchemaType<typeof ProjectPeerReviewSchema>;

export const Announcement: Model<AnnouncementDoc> = models.Announcement || model<AnnouncementDoc>("Announcement", AnnouncementSchema);
export const Notification: Model<NotificationDoc> = models.Notification || model<NotificationDoc>("Notification", NotificationSchema);
export const Certificate: Model<CertificateDoc> = models.Certificate || model<CertificateDoc>("Certificate", CertificateSchema);
export const CourseProject: Model<CourseProjectDoc> = models.CourseProject || model<CourseProjectDoc>("CourseProject", CourseProjectSchema);
export const ProjectSubmission: Model<ProjectSubmissionDoc> = models.ProjectSubmission || model<ProjectSubmissionDoc>("ProjectSubmission", ProjectSubmissionSchema);
export const ProjectSubmissionFile: Model<ProjectSubmissionFileDoc> =
  models.ProjectSubmissionFile || model<ProjectSubmissionFileDoc>("ProjectSubmissionFile", ProjectSubmissionFileSchema);
export const ProjectPeerReview: Model<ProjectPeerReviewDoc> =
  models.ProjectPeerReview || model<ProjectPeerReviewDoc>("ProjectPeerReview", ProjectPeerReviewSchema);
