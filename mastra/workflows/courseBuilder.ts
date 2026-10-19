import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { outlineAgent } from "../agents";
import { buildSkeleton, splitIntoBlocks } from "../../lib/ingestion/parser";
import { setProgress, bump } from "../../lib/jobs/progress";
import { withRetry } from "../../lib/jobs/retry";
import { linkSourceImages, QuizQuestion, writeLecture, writeQuiz } from "../generation";

/**
 * PIPELINE (cost architecture)
 *
 *  sanitized text ──► [1] extractOutlineStep   input: skeleton only (~1-6k tokens), output: tiny JSON
 *                          │  local code slices the REAL text by block ranges (free)
 *                          ▼
 * [2] generateLectureContentStep x N in parallel
 *                          input: ONE chapter chunk (+ module titles), output: Markdown module
 *                          ▼
 *                     [3] generateQuizStep  x N in parallel
 *                          input: that module's content, output: Zod-validated JSON
 *
 * The full document is never sent in one prompt. Total input tokens are roughly
 * skeleton + document text once (spread across modules) + module text once (quizzes),
 * instead of paying for the whole document on every call.
 */

const MAX_CHAPTER_CHARS = 9_000; // ~2.2k tokens of source per chapter call

/* ----------------------------- schemas ----------------------------- */

const OutlineSchema = z.object({
  courseTitle: z.string(),
  description: z.string().max(400),
  topics: z.array(z.string().max(160)).max(10),
  learningOutcomes: z.array(z.string().max(240)).min(3).max(8),
  prerequisites: z.array(z.string().max(200)).max(8),
  skills: z.array(z.string().max(120)).max(10),
  tools: z.array(z.string().max(120)).max(10),
  careerBenefits: z.array(z.string().max(240)).max(6),
  jobRoles: z.array(z.string().max(120)).max(8),
  chapters: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string().max(300),
        startBlock: z.number().int().min(0),
        endBlock: z.number().int().min(0),
      })
    )
    .min(1)
    .max(20),
});

const ChapterJob = z.object({
  courseId: z.string(),
  index: z.number().int(),
  courseTitle: z.string(),
  courseDescription: z.string(),
  topics: z.array(z.string()),
  learningOutcomes: z.array(z.string()),
  prerequisites: z.array(z.string()),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  careerBenefits: z.array(z.string()),
  jobRoles: z.array(z.string()),
  title: z.string(),
  summary: z.string(),
  outline: z.array(z.string()), // all chapter titles, ~100 tokens, gives context
  sourceText: z.string(),
});

const Lecture = ChapterJob.omit({ outline: true }).extend({
  contentMd: z.string(),
});

const ChapterResult = Lecture.extend({ quiz: z.array(QuizQuestion) });
export type ChapterResultT = z.infer<typeof ChapterResult>;

// Low temperature = fewer retries and less rambling.
const structured = { modelSettings: { maxOutputTokens: 3000, temperature: 0.2 } };

/* ------------------------- step 1: outline ------------------------- */

function normalizeRanges(chs: z.infer<typeof OutlineSchema>["chapters"], n: number) {
  // Never trust model-provided indices: force contiguous, ordered, full coverage.
  const sorted = [...chs].sort((a, b) => a.startBlock - b.startBlock);
  const out: { title: string; summary: string; start: number; end: number }[] = [];
  let cursor = 0;
  sorted.forEach((c, i) => {
    if (cursor > n - 1) return;
    const last = i === sorted.length - 1;
    const end = last ? n - 1 : Math.min(Math.max(c.endBlock, cursor), n - 1);
    out.push({ title: c.title, summary: c.summary, start: cursor, end });
    cursor = end + 1;
  });
  return out;
}

export const extractOutlineStep = createStep({
  id: "extract-outline",
  inputSchema: z.object({ text: z.string().min(200), courseId: z.string() }),
  outputSchema: z.array(ChapterJob),
  execute: async ({ inputData }) => {
    const blocks = splitIntoBlocks(inputData.text);
    const avgChars = inputData.text.length / blocks.length;
    const maxBlocks = Math.max(1, Math.floor(MAX_CHAPTER_CHARS / avgChars));
    const minChapters = Math.max(1, Math.ceil(blocks.length / maxBlocks));

    // Retry covers both provider errors and JSON that fails schema validation.
    const outline = await withRetry(async () =>
      OutlineSchema.parse(
        (
          await outlineAgent.generate(
            `Blocks 0-${blocks.length - 1}. Create a concise course guide with 3-8 measurable learner outcomes, ` +
              `up to 10 topics, skills, and tools, up to 8 prerequisites, career benefits, and realistic related job roles. ` +
              `Aim for ${minChapters}-${Math.min(20, minChapters * 2 + 2)} modules, at most ${maxBlocks} blocks each. ` +
              `Ranges are inclusive block ids. Keep each module summary concise and grounded in its source material.\n\nSKELETON:\n${buildSkeleton(blocks)}`,
            { structuredOutput: { schema: OutlineSchema, jsonPromptInjection: true }, ...structured }
          )
        ).object
      )
    );

    // Deterministically split any chapter that is still too large for one call.
    const chapters: { title: string; summary: string; start: number; end: number }[] = [];
    for (const c of normalizeRanges(outline.chapters, blocks.length)) {
      const span = c.end - c.start + 1;
      const parts = Math.ceil(span / maxBlocks);
      for (let p = 0; p < parts; p++) {
        chapters.push({
          title: parts > 1 ? `${c.title} (Part ${p + 1})` : c.title,
          summary: c.summary,
          start: c.start + p * maxBlocks,
          end: Math.min(c.end, c.start + (p + 1) * maxBlocks - 1),
        });
      }
    }

    await setProgress(inputData.courseId, { stage: "writing", title: outline.courseTitle, totalChapters: chapters.length });
    const titles = chapters.map((c) => c.title);
    return chapters.map((c, i) => ({
      courseId: inputData.courseId,
      index: i,
      courseTitle: outline.courseTitle,
      courseDescription: outline.description,
      topics: outline.topics,
      learningOutcomes: outline.learningOutcomes,
      prerequisites: outline.prerequisites,
      skills: outline.skills,
      tools: outline.tools,
      careerBenefits: outline.careerBenefits,
      jobRoles: outline.jobRoles,
      title: c.title,
      summary: c.summary,
      outline: titles,
      sourceText: blocks
        .slice(c.start, c.end + 1)
        .map((b) => b.text)
        .join("\n\n"),
    }));
  },
});

/* ----------------------- step 2: lecture notes ---------------------- */

export const generateChapterContentStep = createStep({
  id: "generate-chapter-content",
  inputSchema: ChapterJob,
  outputSchema: Lecture,
  execute: async ({ inputData: j }) => {
    const contentMd = linkSourceImages(await writeLecture({
      courseTitle: j.courseTitle,
      outline: j.outline,
      index: j.index,
      title: j.title,
      sourceText: j.sourceText,
    }), j.sourceText, j.courseId);
    await bump(j.courseId, "lecturesDone");
    return {
      courseId: j.courseId,
      index: j.index,
      courseTitle: j.courseTitle,
      courseDescription: j.courseDescription,
      topics: j.topics,
      learningOutcomes: j.learningOutcomes,
      prerequisites: j.prerequisites,
      skills: j.skills,
      tools: j.tools,
      careerBenefits: j.careerBenefits,
      jobRoles: j.jobRoles,
      title: j.title,
      summary: j.summary,
      sourceText: j.sourceText, // kept so a single chapter can be regenerated later
      contentMd,
    };
  },
});

/* ------------------------- step 3: quiz ----------------------------- */

export const generateQuizStep = createStep({
  id: "generate-quiz",
  inputSchema: Lecture,
  outputSchema: ChapterResult,
  execute: async ({ inputData: l }) => {
    let quiz: z.infer<typeof QuizQuestion>[] = [];
    try {
      quiz = await writeQuiz({ title: l.title, contentMd: l.contentMd });
    } catch (err) {
      // A failed quiz must not sink the whole course: the lecture ships without one.
      console.warn(`[quiz] chapter ${l.index} skipped`, err);
    }
    await bump(l.courseId, "quizzesDone");
    return { ...l, quiz };
  },
});

/* ---------------------------- workflow ------------------------------ */

export const courseBuilderWorkflow = createWorkflow({
  id: "course-builder",
  inputSchema: z.object({ text: z.string().min(200), courseId: z.string() }),
  outputSchema: z.array(ChapterResult),
})
  .then(extractOutlineStep)
  // concurrency 3: fast enough, gentle on provider rate limits.
  .foreach(generateChapterContentStep, { concurrency: 3 })
  .foreach(generateQuizStep, { concurrency: 3 })
  .commit();
