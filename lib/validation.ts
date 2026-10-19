import { z } from "zod";
import { getInlineChapterVideoUrls, resolveChapterVideo } from "./chapterVideo";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const nonEmpty = (max: number, label: string) =>
  z.string().trim().min(1, `${label} can't be empty`).max(max, `${label} is too long`);

export const CoursePatch = z
  .object({
    title: nonEmpty(200, "Title").optional(),
    description: z.string().trim().max(1000, "Description is too long").optional(),
    codePracticeEnabled: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const CodePracticeRunInput = z.object({
  chapterId: objectId,
  language: z.enum(["python", "java", "c"]),
  source: z.string().max(30_000, "Code must be 30,000 characters or fewer"),
});

export const NewCatalogCourse = z.object({
  title: nonEmpty(200, "Title"),
  description: z.string().trim().max(1000, "Description is too long"),
  categoryId: objectId,
});

export const VideoCourseInput = z.object({
  title: nonEmpty(200, "Course title"),
  description: z.string().trim().max(1000, "Description is too long"),
  categoryId: objectId,
  lessons: z.array(z.object({
    title: nonEmpty(200, "Lesson title"),
    videoUrl: z.string().trim().max(2000, "Video URL is too long").url("Enter a valid video URL").refine(
      (url) => resolveChapterVideo(url) !== null,
      "Use YouTube, Vimeo, or a direct MP4, WebM, or Ogg URL"
    ),
  })).min(1, "Add at least one video lesson").max(100, "A course can have at most 100 lessons"),
});

export const CourseCategoryName = nonEmpty(80, "Category name");

export const HomepageContentInput = z.object({
  heroTitle: nonEmpty(120, "Hero title"),
  heroDescription: nonEmpty(1000, "Hero description"),
  primaryCta: nonEmpty(60, "Primary button label"),
  secondaryCta: nonEmpty(60, "Secondary button label"),
  heroFootnote: nonEmpty(200, "Hero note"),
  codeExampleLabel: nonEmpty(80, "Code example label"),
});

export const NewCourseGroup = z.object({
  name: nonEmpty(100, "Group name"),
  courseIds: z.array(objectId).min(1, "Choose at least one course").max(100, "A group can include at most 100 courses"),
});

const ChapterVideoUrl = z.union([
  z.literal(""),
  z.string().trim().max(2000, "Video URL is too long").url("Enter a valid video URL").refine(
    (url) => resolveChapterVideo(url) !== null,
    "Use YouTube, Vimeo, or a direct MP4, WebM, or Ogg URL"
  ),
]);

export const ChapterPatch = z
  .object({
    title: nonEmpty(200, "Title").optional(),
    contentMd: nonEmpty(60_000, "Module text").optional(),
    videoUrl: ChapterVideoUrl.optional(),
  })
  .refine(
    (value) => value.contentMd === undefined || getInlineChapterVideoUrls(value.contentMd).every((url) => resolveChapterVideo(url) !== null),
    "Each video section must have a valid YouTube, Vimeo, or direct video link"
  )
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const EditableQuestion = z
  .object({
    question: nonEmpty(500, "Question"),
    options: z.array(nonEmpty(300, "Option")).min(2, "Each question needs at least 2 options").max(6, "At most 6 options"),
    correctIndex: z.number().int().min(0),
    explanation: nonEmpty(400, "Explanation"),
  })
  .refine((q) => q.correctIndex < q.options.length, "Pick which option is correct");

export const QuizPut = z.object({ questions: z.array(EditableQuestion).max(15, "At most 15 questions") });
export const ReorderBody = z.object({ order: z.array(objectId).min(1) });
export const NewChapterBody = z.object({ title: nonEmpty(200, "Title").optional() });
export const SharingBody = z.object({ enabled: z.boolean().optional(), reset: z.boolean().optional() });
export const RegenerateBody = z.object({
  target: z.enum(["lecture", "quiz"]),
  guidance: z.string().trim().max(300, "Guidance is too long (300 characters max)").optional(),
  contentMd: z.string().max(60_000).optional(), // for quizzes: build from the (possibly unsaved) module text
});
