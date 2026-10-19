import { isValidObjectId } from "mongoose";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { json } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { CodePracticeRunInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runnerVersions = {
  python: "3.10.0",
  java: "15.0.2",
  c: "10.2.0",
} as const;

const MAX_REQUEST_BYTES = 40_000;
const MAX_OUTPUT_CHARS = 8_000;

type RunnerOutput = {
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number | null;
  signal?: string | null;
};

function isRunnerOutput(value: unknown): value is RunnerOutput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return (
    ["stdout", "stderr", "output"].every((key) => output[key] === undefined || typeof output[key] === "string") &&
    (output.code === undefined || output.code === null || typeof output.code === "number") &&
    (output.signal === undefined || output.signal === null || typeof output.signal === "string")
  );
}

function boundedText(value: string | undefined) {
  return typeof value === "string" ? value.slice(0, MAX_OUTPUT_CHARS) : "";
}

function outputText(result: RunnerOutput | null | undefined) {
  if (!result) return "";
  return boundedText(result.output) ||
    [boundedText(result.stdout), boundedText(result.stderr)].filter(Boolean).join("\n");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in to run code." }, 401);

  const { id: courseId } = await params;
  if (!isValidObjectId(courseId)) return json({ error: "Course not found." }, 404);

  const access = await getCourseAccess(courseId, userId);
  if (!access) return json({ error: "Course not found or access is not available." }, 404);
  if (!access.course.codePracticeEnabled) {
    return json({ error: "Code practice is not enabled for this course." }, 403);
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "Code request is too large. Keep it under 30,000 characters." }, 413);
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return json({ error: "Code request is too large. Keep it under 30,000 characters." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "The code request was not valid JSON." }, 400);
  }

  const parsed = CodePracticeRunInput.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Invalid code request." }, 400);
  }

  const { chapterId, language, source } = parsed.data;
  const chapterExists = await Chapter.exists({ _id: chapterId, courseId });
  if (!chapterExists) return json({ error: "Module not found in this course." }, 404);

  const runnerUrl = process.env.CODE_RUNNER_URL?.trim().replace(/\/+$/, "");
  if (!runnerUrl) {
    return json({ error: "The code runner is not configured. Ask an administrator to configure the self-hosted runner." }, 503);
  }

  let runnerResponse: Response;
  try {
    runnerResponse = await fetch(`${runnerUrl}/api/v2/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        language,
        version: runnerVersions[language],
        files: [{
          name: language === "python" ? "main.py" : language === "java" ? "Main.java" : "main.c",
          content: source,
        }],
        stdin: "",
        args: [],
        compile_timeout: 10_000,
        run_timeout: 5_000,
        compile_memory_limit: 268_435_456,
        run_memory_limit: 134_217_728,
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("Code runner request failed", error);
    return json({
      error: timedOut
        ? "Code execution took too long. Try again with a shorter program."
        : "The code runner could not be reached. Please try again later.",
    }, timedOut ? 504 : 503);
  }

  if (!runnerResponse.ok) {
    console.error("Code runner returned an unsuccessful response", runnerResponse.status);
    return json({ error: "The code runner could not complete this request. Please try again later." }, 502);
  }

  let runnerBody: unknown;
  try {
    runnerBody = await runnerResponse.json();
  } catch (error) {
    console.error("Code runner returned invalid JSON", error);
    return json({ error: "The code runner returned an invalid response. Please try again later." }, 502);
  }

  if (
    typeof runnerBody !== "object" ||
    runnerBody === null ||
    Array.isArray(runnerBody) ||
    !isRunnerOutput((runnerBody as Record<string, unknown>).run) ||
    (
      (runnerBody as Record<string, unknown>).compile !== undefined &&
      (runnerBody as Record<string, unknown>).compile !== null &&
      !isRunnerOutput((runnerBody as Record<string, unknown>).compile)
    )
  ) {
    console.error("Code runner response did not include a run result");
    return json({ error: "The code runner returned an incomplete response. Please try again later." }, 502);
  }

  const runnerResult = runnerBody as { compile?: RunnerOutput | null; run: RunnerOutput };
  return json({
    compileOutput: outputText(runnerResult.compile),
    output: outputText(runnerResult.run),
    exitCode: typeof runnerResult.run.code === "number" ? runnerResult.run.code : null,
    signal: typeof runnerResult.run.signal === "string" ? runnerResult.run.signal.slice(0, 80) : null,
  });
}
