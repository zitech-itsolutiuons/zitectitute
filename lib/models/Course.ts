import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * COST NOTE: we never persist the raw uploaded text. Chapters store the final
 * lecture Markdown only, and the chat route reads a single chapter by id.
 * That keeps documents small and lets the assistant load exactly one chapter
 * into context instead of the whole course.
 */

const CourseSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    instructorId: { type: String, default: null, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    categoryId: { type: Schema.Types.ObjectId, ref: "CourseCategory", default: null, index: true },
    format: { type: String, enum: ["standard", "video"], default: "standard", index: true },
    codePracticeEnabled: { type: Boolean, default: false },
    topics: { type: [String], default: [] },
    learningOutcomes: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    tools: { type: [String], default: [] },
    careerBenefits: { type: [String], default: [] },
    jobRoles: { type: [String], default: [] },
    sourceFileName: String,
    status: { type: String, enum: ["comingSoon", "processing", "ready", "failed"], default: "processing" },
    chapterCount: { type: Number, default: 0 },
    catalogVisible: { type: Boolean, default: false },
    priceKobo: { type: Number, default: null, min: 100 },
    // Background build progress (written by lib/jobs/progress.ts)
    stage: { type: String, default: "queued" },
    totalChapters: { type: Number, default: 0 },
    lecturesDone: { type: Number, default: 0 },
    quizzesDone: { type: Number, default: 0 },
    error: String,
    // Sharing: students join through /join/<shareCode> while sharingEnabled is true
    sharingEnabled: { type: Boolean, default: false },
    shareCode: { type: String, index: true },
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

const ChapterSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    index: { type: Number, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    contentMd: { type: String, required: true }, // lecture-level Markdown body
    videoUrl: { type: String, default: "" },
    // The source excerpt this chapter was written from. Kept so one chapter can be regenerated.
    sourceText: { type: String, select: false },
  },
  { timestamps: true }
);
ChapterSchema.index({ courseId: 1, index: 1 }, { unique: true });

const CourseMediaSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    index: { type: Number, required: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);
CourseMediaSchema.index({ courseId: 1, index: 1 }, { unique: true });

const QuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: {
      type: [String],
      validate: [(v: string[]) => v.length >= 2 && v.length <= 6, "A question needs 2-6 options"],
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, required: true }, // brief, shown after answering
  },
  { _id: false }
);

const QuizSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true, unique: true },
    questions: { type: [QuestionSchema], default: [] },
  },
  { timestamps: true }
);

const FinalTheoryQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    sampleAnswer: { type: String, required: true },
    gradingPoints: { type: [String], required: true },
  },
  { _id: false }
);

const CourseFinalAssessmentSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, unique: true, index: true },
    objectiveQuestions: { type: [QuestionSchema], default: [] },
    theoryQuestions: { type: [FinalTheoryQuestionSchema], default: [] },
  },
  { timestamps: true }
);

/** Student analytics: one document per (student, course). */
const StudentProgressSchema = new Schema(
  {
    userId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    completedChapterIds: [{ type: Schema.Types.ObjectId, ref: "Chapter" }],
    completedSections: [
      {
        chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
        sectionId: { type: String, required: true },
        _id: false,
      },
    ],
    lastChapterId: { type: Schema.Types.ObjectId, ref: "Chapter" },
    quizAttempts: [
      {
        chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
        score: Number,
        total: Number,
        answers: [Number], // chosen option index per question
        questionIndexes: [Number],
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    finalAssessmentAttempts: [
      {
        objectiveScore: { type: Number, required: true },
        objectiveTotal: { type: Number, required: true },
        objectiveAnswers: { type: [Number], required: true },
        theoryAnswers: { type: [String], required: true },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    assistantMessages: { type: Number, default: 0 }, // usage / cost monitoring per student
    chatCounts: { type: Map, of: Number, default: {} }, // assistant questions per chapterId
    // Captured when the student joins, so the instructor can see who is who
    displayName: String,
    email: String,
    enrolledAt: Date,
  },
  { timestamps: true }
);
StudentProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

if (models.StudentProgress && !models.StudentProgress.schema.path("quizAttempts.questionIndexes")) {
  delete models.StudentProgress;
}

const StudentNoteSchema = new Schema(
  {
    userId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
    content: { type: String, required: true, maxlength: 20_000, default: "" },
  },
  { timestamps: true }
);
StudentNoteSchema.index({ userId: 1, courseId: 1, chapterId: 1 }, { unique: true });

const CourseRestrictionSchema = new Schema(
  {
    userId: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    restrictedBy: { type: String, required: true },
  },
  { timestamps: true }
);
CourseRestrictionSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const CourseGroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, index: true },
    courseIds: [{ type: Schema.Types.ObjectId, ref: "Course", required: true }],
    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

const CourseGroupSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export type CourseDoc = InferSchemaType<typeof CourseSchema>;
export type ChapterDoc = InferSchemaType<typeof ChapterSchema>;
export type CourseMediaDoc = InferSchemaType<typeof CourseMediaSchema>;
export type QuizDoc = InferSchemaType<typeof QuizSchema>;
export type CourseFinalAssessmentDoc = InferSchemaType<typeof CourseFinalAssessmentSchema>;
export type StudentProgressDoc = InferSchemaType<typeof StudentProgressSchema>;
export type StudentNoteDoc = InferSchemaType<typeof StudentNoteSchema>;
export type CourseRestrictionDoc = InferSchemaType<typeof CourseRestrictionSchema>;
export type CourseGroupDoc = InferSchemaType<typeof CourseGroupSchema>;
export type CourseGroupSettingsDoc = InferSchemaType<typeof CourseGroupSettingsSchema>;

// Refresh a cached dev model when newer course fields were added after compilation.
if (
  models.Course &&
  (!models.Course.schema.path("priceKobo") ||
    !models.Course.schema.path("topics") ||
    !models.Course.schema.path("codePracticeEnabled") ||
    !models.Course.schema.path("categoryId") ||
    !models.Course.schema.path("instructorId"))
) {
  delete models.Course;
}

// `models.X ||` prevents "OverwriteModelError" during Next.js hot reload.
export const Course: Model<CourseDoc> = models.Course || model<CourseDoc>("Course", CourseSchema);
export const Chapter: Model<ChapterDoc> = models.Chapter || model<ChapterDoc>("Chapter", ChapterSchema);
export const CourseMedia: Model<CourseMediaDoc> = models.CourseMedia || model<CourseMediaDoc>("CourseMedia", CourseMediaSchema);
export const Quiz: Model<QuizDoc> = models.Quiz || model<QuizDoc>("Quiz", QuizSchema);
export const CourseFinalAssessment: Model<CourseFinalAssessmentDoc> =
  models.CourseFinalAssessment || model<CourseFinalAssessmentDoc>("CourseFinalAssessment", CourseFinalAssessmentSchema);
export const StudentProgress: Model<StudentProgressDoc> =
  models.StudentProgress || model<StudentProgressDoc>("StudentProgress", StudentProgressSchema);
export const StudentNote: Model<StudentNoteDoc> = models.StudentNote || model<StudentNoteDoc>("StudentNote", StudentNoteSchema);
export const CourseRestriction: Model<CourseRestrictionDoc> =
  models.CourseRestriction || model<CourseRestrictionDoc>("CourseRestriction", CourseRestrictionSchema);
export const CourseGroup: Model<CourseGroupDoc> = models.CourseGroup || model<CourseGroupDoc>("CourseGroup", CourseGroupSchema);
export const CourseGroupSettings: Model<CourseGroupSettingsDoc> =
  models.CourseGroupSettings || model<CourseGroupSettingsDoc>("CourseGroupSettings", CourseGroupSettingsSchema);
