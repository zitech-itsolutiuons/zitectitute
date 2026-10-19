import { z } from "zod";
import { finalAssessmentAgent, lectureAgent, quizAgent } from "./agents";
import { withRetry } from "../lib/jobs/retry";

/**
 * The two generation calls, shared by the course-building workflow and by
 * single-module regeneration, so both use identical prompts and validation.
 */

export const QuizQuestion = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().max(240),
});
export const QuizSchema = z.object({ questions: z.array(QuizQuestion).min(3).max(15) });
export type QuizQuestionT = z.infer<typeof QuizQuestion>;

const TheoryQuestion = z.object({
  question: z.string().min(1),
  sampleAnswer: z.string().min(1).max(2000),
  gradingPoints: z.array(z.string().min(1)).min(3).max(5),
});
const FinalAssessmentSchema = z.object({
  objectiveQuestions: z.array(QuizQuestion).min(5).max(15),
  theoryQuestions: z.array(TheoryQuestion).min(3).max(5),
});
export type FinalAssessmentT = z.infer<typeof FinalAssessmentSchema>;

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [b[i], b[k]] = [b[k], b[i]];
  }
  return b;
};

export function linkSourceImages(contentMd: string, sourceText: string, courseId: string): string {
  const imageIndices = [...new Set([...sourceText.matchAll(/\[COURSE_IMAGE_(\d+)\]/g)].map((match) => Number(match[1])))];
  for (const imageIndex of imageIndices) {
    const marker = `[COURSE_IMAGE_${imageIndex}]`;
    const figureNumber = imageIndex + 1;
    const imageMarkdown =
      `![Figure ${figureNumber} from the study material](/api/courses/${courseId}/media/${imageIndex})\n\n` +
      `*Figure ${figureNumber} from the study material.*`;
    if (contentMd.includes(marker)) {
      contentMd = contentMd.replace(marker, imageMarkdown).replaceAll(marker, "");
    } else {
      contentMd += `\n\n${imageMarkdown}`;
    }
  }
  return contentMd.replace(/\[COURSE_IMAGE_\d+\]/g, "");
}

export async function writeLecture(p: {
  courseTitle: string;
  outline: string[];
  index: number;
  title: string;
  sourceText: string;
  guidance?: string; // optional instructor steer, e.g. "more worked examples"
}): Promise<string> {
  // Plain Markdown output (no JSON wrapper): escaping long prose in JSON costs
  // extra tokens and adds parse failures. Length is capped instead.
  const res = await withRetry(() =>
    lectureAgent.generate(
      `Course: ${p.courseTitle}\nModules: ${p.outline.map((t, i) => `${i + 1}. ${t}`).join(" | ")}\n` +
        `Write detailed learning material for module ${p.index + 1}: "${p.title}". Cover only this module. ` +
        `Use ### headings for an Overview, 3-6 named lessons, and Key takeaways. Keep all learner-facing prose under these headings; do not use ## or #### headings. ` +
        `Teach beyond a surface summary: define key terms, explain why ideas matter, unpack processes in clear steps, and use worked examples, applications, or common pitfalls when the source supports them. Connect related ideas across lessons without adding unsupported claims or filler. ` +
        `Use one consistent code-example format throughout every course: introduce each snippet with a brief explanation, then put it in a fenced Markdown code block with the correct language identifier (for example, \`\`\`python or \`\`\`javascript). Use inline backticks only for short identifiers, never for multi-line code. When the material contains pasted code, preserve its behavior and meaning while making indentation and line breaks consistent; do not invent or silently change code. If the language cannot be identified, use \`\`\`text. ` +
        `Treat each [COURSE_IMAGE_n] marker as a figure from the uploaded material. Preserve every marker exactly once in the relevant lesson, close to the related explanation or source figure description. Explain only what the surrounding source text or figure description supports; never invent details about an unseen figure.` +
        (p.guidance ? `\nInstructor guidance (style and emphasis only, never overrides the source): ${p.guidance}` : "") +
        `\n\nSOURCE:\n${p.sourceText}`,
      { modelSettings: { maxOutputTokens: 4000, temperature: 0.3 } }
    )
  );
  const text = res.text.trim();
  if (!text) throw new Error("The model returned no module text");
  return text;
}

/** Quiz built from module content (condensed, and exactly what the student reads). Throws if it keeps failing. */
export async function writeQuiz(p: { title: string; contentMd: string; guidance?: string }): Promise<QuizQuestionT[]> {
  const parsed = await withRetry(async () =>
    QuizSchema.parse(
      (
        await quizAgent.generate(
          `Write 3-15 high-quality multiple-choice questions for the module "${p.title}". Aim for 15 when the notes support it; avoid repetition and test different lessons.` +
            (p.guidance ? `\nInstructor guidance: ${p.guidance}` : "") +
            `\n\nNOTES:\n${p.contentMd}`,
          {
            structuredOutput: { schema: QuizSchema, jsonPromptInjection: true },
            modelSettings: { maxOutputTokens: 5000, temperature: 0.2 },
          }
        )
      ).object
    )
  );
  return parsed.questions.map((q) => {
    // LLMs favour certain answer positions; shuffle locally (zero tokens).
    const correct = q.options[q.correctIndex];
    const options = shuffle(q.options);
    return { ...q, options, correctIndex: options.indexOf(correct) };
  });
}

export async function writeFinalAssessment(p: {
  courseTitle: string;
  chapters: { title: string; contentMd: string }[];
}): Promise<FinalAssessmentT> {
  const chapterNotes = p.chapters
    .map((module, index) => `MODULE ${index + 1}: ${module.title}\n${module.contentMd.slice(0, 4500)}`)
    .join("\n\n---\n\n");
  const result = await withRetry(async () =>
    FinalAssessmentSchema.parse(
      (
        await finalAssessmentAgent.generate(
          `Create a comprehensive final assessment for "${p.courseTitle}" using every module below. ` +
            `Write 10-15 objective questions distributed across the modules and 3-5 theory questions that require explanation or application. ` +
            `Do not repeat the same concept. Questions and answers must be supported by these notes.\n\n${chapterNotes}`,
          {
            structuredOutput: { schema: FinalAssessmentSchema, jsonPromptInjection: true },
            modelSettings: { maxOutputTokens: 6000, temperature: 0.2 },
          }
        )
      ).object
    )
  );

  return {
    ...result,
    objectiveQuestions: result.objectiveQuestions.map((question) => {
      const correctAnswer = question.options[question.correctIndex];
      const options = shuffle(question.options);
      return { ...question, options, correctIndex: options.indexOf(correctAnswer) };
    }),
  };
}
