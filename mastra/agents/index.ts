import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * DeepSeek via its OpenAI-compatible endpoint.
 * Alternative: Mastra's model router, e.g. `model: "deepseek/deepseek-chat"`
 * (reads DEEPSEEK_API_KEY from env), which removes this provider block.
 *
 * COST NOTES
 * - We use `deepseek-chat` everywhere. `deepseek-reasoner` (R1) bills its hidden
 *   reasoning tokens as output, which is wasteful for summarise / rewrite /
 *   quiz-from-text tasks that don't need multi-step reasoning.
 * - Each agent's `instructions` are static and identical across calls. DeepSeek
 *   applies automatic prefix caching, so repeated identical prefixes are billed
 *   at the (much lower) cache-hit rate. Keep variable content AFTER static text.
 */
export const deepseek = createOpenAICompatible({
  name: "deepseek",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

const chatModel = deepseek("deepseek-chat");

/** Step 1: reads a skeleton and returns module ranges. Output is JSON only. */
export const outlineAgent = new Agent({
  id: "outline-agent",
  name: "outline-agent",
  model: chatModel,
  instructions:
    "You design a course guide and module structure from a document skeleton. Return only the requested JSON. " +
    "Base the description, topics, outcomes, prerequisites, skills, and tools on the supplied document. " +
    "Suggest realistic job roles and learning-related career benefits that follow from the taught skills; never promise employment, salary, or certification. " +
    "Do not claim tools or prerequisites that are not supported by the material. Use an empty list when none are supported. " +
    "Modules must be contiguous, in order, and cover every block id exactly once.",
});

/** Step 2: expands one module's source text into module learning material. */
export const lectureAgent = new Agent({
  id: "lecture-agent",
  name: "lecture-agent",
  model: chatModel,
  instructions:
    "You are an instructor writing detailed, self-contained course module content in Markdown. " +
    "Teach from the provided source only: explain the why, define terms, unpack processes step by step, and use concrete examples from the source where available. " +
    "Use one consistent code-example format throughout every course: introduce each snippet with a brief explanation, then put it in a fenced Markdown code block with the correct language identifier. Use inline backticks only for short identifiers, never for multi-line code. When the material contains pasted code, preserve its behavior and meaning while making indentation and line breaks consistent; do not invent or silently change code. If the language cannot be identified, use the text fence. " +
    "Treat [COURSE_IMAGE_n] markers as source figures. Keep each marker exactly once beside the related explanation, and explain it only from surrounding source text or an explicit figure description; do not invent visual details. " +
    "Structure: '## Overview', 3-6 meaningful '###' lessons, bold key terms, and '## Key takeaways' (max 5 bullets). " +
    "No greetings, no meta-commentary, never mention 'the source' or 'the text'. Output Markdown only.",
});

/** Step 3: quiz strictly from module content. Output is JSON only. */
export const quizAgent = new Agent({
  id: "quiz-agent",
  name: "quiz-agent",
  model: chatModel,
  instructions:
    "You write multiple-choice quizzes using ONLY the provided module content. " +
    "Test understanding, not trivia. Exactly 4 options, one correct, plausible distractors, " +
    "one-sentence explanation. Return only the requested JSON.",
});

/** Course-wide final assessment: comprehensive objective and written questions. */
export const finalAssessmentAgent = new Agent({
  id: "final-assessment-agent",
  name: "final-assessment-agent",
  model: chatModel,
  instructions:
    "You write comprehensive final course assessments using ONLY the provided module content. " +
    "Balance coverage across modules and test understanding, application, and connections between topics. " +
    "Objective items must have exactly 4 plausible options, one correct answer, and a concise explanation. " +
    "Theory prompts must be answerable from the notes and include a model answer plus 3-5 grading points. " +
    "Return only the requested JSON.",
});

/** Study assistant: module text is injected per request by /api/chat. */
export const studyAssistant = new Agent({
  id: "study-assistant",
  name: "study-assistant",
  model: chatModel,
  instructions:
    "You are a study assistant for one course module. Answer ONLY from the module provided in the system message. " +
    "If the answer is not in the module, say so in one sentence and suggest what to review. " +
    "Be brief: at most 120 words, plain language, use a short list only when it helps.",
});
