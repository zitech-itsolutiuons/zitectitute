import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { StudentProgress } from "@/lib/models/Course";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/Course";
import { studyAssistant } from "@/mastra/agents";

export const runtime = "nodejs";

const Body = z.object({
  chapterId: z.string().regex(/^[a-f\d]{24}$/i),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(30),
});

/**
 * WHY NO VECTOR DATABASE
 * A chapter is capped at ~2k tokens of lecture Markdown, so the whole chapter
 * fits in context. That is "retrieval" with perfect recall and zero infra.
 * If you later add course-wide Q&A, embed chapter summaries (Mongo Atlas Vector
 * Search) and inject the top 1-2 chapters the same way.
 *
 * COST CONTROLS
 * 1. The server loads the chapter by id. The client never uploads text, so the
 *    payload is tiny and the context can't be tampered with.
 * 2. The chapter block goes FIRST in the system message and stays identical for
 *    the whole chat, so DeepSeek's prefix cache serves it at the cache-hit rate.
 * 3. Only the last 6 turns are sent; output is capped at 400 tokens.
 */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return new Response("Sign in required", { status: 401 });
  // TODO: add per-user rate limiting here.
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const { chapterId, messages } = parsed.data;

  await connectDB();
  const chapter = await Chapter.findById(chapterId).select("title contentMd courseId").lean();
  if (!chapter) return new Response("Module not found", { status: 404 });
  // Owners and enrolled students only.
  if (!(await getCourseAccess(String(chapter.courseId), userId)))
    return new Response("Module not found", { status: 404 });

  // Usage counters feed the instructor dashboard (which chapters prompt the most questions).
  StudentProgress.updateOne(
    { userId, courseId: chapter.courseId },
    { $inc: { assistantMessages: 1, [`chatCounts.${chapterId}`]: 1 } },
    { upsert: true }
  ).catch(() => {});

  const system = `MODULE: ${chapter.title}\n---\n${chapter.contentMd.slice(0, 7000)}\n---\nAnswer only from this module.`;

  const result = await studyAssistant.stream(
    [{ role: "system" as const, content: system }, ...messages.slice(-6).map((m) =>
        m.role === "user"
          ? { role: "user" as const, content: m.content }
          : { role: "assistant" as const, content: m.content }
      ),
    ],
    { modelSettings: { maxOutputTokens: 400, temperature: 0.3 } }
  );

  // Plain text stream: no client SDK needed, and stable across Mastra versions.
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) controller.enqueue(enc.encode(chunk));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
