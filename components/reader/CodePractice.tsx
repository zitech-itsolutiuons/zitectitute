"use client";

import { useEffect, useRef, useState } from "react";

type EditorTab = "html" | "css" | "javascript" | "python" | "java" | "c";
type OutputLine = { kind: "log" | "warn" | "error"; text: string };

const editorTabs: EditorTab[] = ["html", "css", "javascript", "python", "java", "c"];
const browserLanguages = new Set<EditorTab>(["html", "css", "javascript"]);
const starterCode: Record<EditorTab, string> = {
  html: `<h1>Hello, world!</h1>
<p>Change this page, then run your code.</p>
<button id="hello-button">Click me</button>`,
  css: `body {
  font-family: system-ui, sans-serif;
  padding: 2rem;
  color: #183b2d;
}

button {
  padding: 0.5rem 0.75rem;
}`,
  javascript: `document.querySelector("#hello-button").addEventListener("click", () => {
  console.log("Your code is running!");
  });`,
    python: `print("Hello, world!")`,
    java: `public class Main {
      public static void main(String[] args) {
          System.out.println("Hello, world!");
      }
  }`,
    c: `#include <stdio.h>

  int main(void) {
      printf("Hello, world!\\n");
      return 0;
  }`,
  };

  const tabLabels: Record<EditorTab, string> = {
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    c: "C",
  };
  const filenames: Record<EditorTab, string> = {
    html: "index.html",
    css: "styles.css",
    javascript: "script.js",
    python: "main.py",
    java: "Main.java",
    c: "main.c",
  };

function escapeClosingTag(value: string, tagName: string) {
  return value.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`);
}

function createPreviewDocument(html: string, css: string, javascript: string) {
  const policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "navigate-to 'none'",
  ].join("; ");
  const instrumentation = `
    (function () {
      const format = (value) => {
        if (typeof value === "string") return value;
        try { return JSON.stringify(value) ?? String(value); }
        catch { return String(value); }
      };
      ["log", "warn", "error"].forEach((kind) => {
        const original = console[kind].bind(console);
        console[kind] = (...values) => {
          original(...values);
          parent.postMessage({
            type: "course-code-practice-output",
            kind,
            text: values.map(format).join(" ")
          }, "*");
        };
      });
      window.addEventListener("error", (event) => {
        parent.postMessage({
          type: "course-code-practice-output",
          kind: "error",
          text: event.message || "A script error occurred."
        }, "*");
      });
    })();
  `;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${policy}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${escapeClosingTag(css, "style")}</style>
  <script>${escapeClosingTag(instrumentation, "script")}</script>
</head>
<body>
${html}
<script>${escapeClosingTag(javascript, "script")}</script>
</body>
</html>`;
}

export default function CodePractice({ courseId, chapterId }: { courseId: string; chapterId: string }) {
  const [code, setCode] = useState(starterCode);
  const [activeTab, setActiveTab] = useState<EditorTab>("html");
  const [previewDocument, setPreviewDocument] = useState("");
  const [runVersion, setRunVersion] = useState(0);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const receiveOutput = (event: MessageEvent<unknown>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (typeof event.data !== "object" || event.data === null) return;
      const data = event.data as Record<string, unknown>;
      const kind = data.kind;
      const text = data.text;
      if (
        data.type !== "course-code-practice-output" ||
        (kind !== "log" && kind !== "warn" && kind !== "error") ||
        typeof text !== "string"
      ) return;

      setOutput((lines) => [
        ...lines.slice(-49),
        { kind, text: text.slice(0, 2000) },
      ]);
    };

    window.addEventListener("message", receiveOutput);
    return () => window.removeEventListener("message", receiveOutput);
  }, []);

  const runCode = async () => {
    setOutput([]);
    setRunError("");
    setExitCode(null);

    if (browserLanguages.has(activeTab)) {
      setPreviewDocument(createPreviewDocument(code.html, code.css, code.javascript));
      setRunVersion((version) => version + 1);
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/code-practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, language: activeTab, source: code[activeTab] }),
      });
      const result = await response.json().catch(() => null) as {
        error?: string;
        compileOutput?: string;
        output?: string;
        run?: unknown;
        exitCode?: number | null;
        signal?: string | null;
      } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not run your program. Please try again.");
      if (!result || typeof result.output !== "string" || typeof result.compileOutput !== "string") {
        throw new Error("The code runner returned an incomplete result. Please try again.");
      }

      const lineFromOutput = (text: string, kind: OutputLine["kind"]) => {
        if (!text) return [];
        return text.split(/\r?\n/).filter(Boolean).map((line) => ({ kind, text: line }));
      };
      setOutput([
        ...lineFromOutput(result.compileOutput, "error"),
        ...lineFromOutput(result.output, result.exitCode === 0 ? "log" : "error"),
      ].slice(0, 50));
      setExitCode(typeof result.exitCode === "number" ? result.exitCode : null);
      if (result.signal) {
        const stoppedLine: OutputLine = { kind: "error", text: `Process stopped: ${result.signal}` };
        setOutput((lines) => [...lines, stoppedLine].slice(0, 50));
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not run your program. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  const selectLanguage = (language: EditorTab) => {
    setActiveTab(language);
    setOutput([]);
    setRunError("");
    setExitCode(null);
  };
  const lineCount = code[activeTab].split("\n").length;
  const statusText = isRunning
    ? "Running"
    : runError
      ? "Needs attention"
      : exitCode === null
        ? "Ready"
        : exitCode === 0
          ? "Finished"
          : "Exited with errors";

  return (
    <section
      aria-labelledby="code-practice-heading"
      className="mx-auto mt-14 max-w-6xl border-y border-emerald-900/20 py-7 dark:border-emerald-200/20 sm:py-9"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 px-1 sm:px-2">
        <div className="max-w-[65ch]">
          <h2 id="code-practice-heading" className="text-xl font-semibold text-emerald-950 dark:text-emerald-100">
            Code workspace
          </h2>
          <p className="mt-1 text-sm leading-6 text-emerald-950/75 dark:text-emerald-100/75">
            Write, run, and refine a small program alongside your lesson.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runCode()}
          disabled={isRunning}
          className="inline-flex min-h-10 items-center justify-center gap-2 border border-emerald-900 bg-emerald-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-200 dark:bg-emerald-200 dark:text-emerald-950 dark:hover:bg-emerald-100"
        >
          {isRunning ? (
            <>
              <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-emerald-950/30 dark:border-t-emerald-950 motion-reduce:animate-none" />
              Running
            </>
          ) : (
            <>
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M4 2.75c0-.58.63-.94 1.13-.64l7.2 4.25a.75.75 0 0 1 0 1.29l-7.2 4.25A.75.75 0 0 1 4 11.25z" />
              </svg>
              Run {tabLabels[activeTab]}
            </>
          )}
        </button>
      </div>

      {runError && (
        <p role="alert" className="mb-4 border-y border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {runError}
        </p>
      )}

      <div className="overflow-hidden border border-emerald-950/25 bg-white shadow-[0_12px_36px_-28px_rgba(15,45,32,0.7)] dark:border-emerald-100/20 dark:bg-[#17211d]">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#1d2c25] px-3 py-2 text-xs text-emerald-50/75 sm:px-4">
          <p className="font-semibold uppercase tracking-[0.12em]">Lesson workspace</p>
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${isRunning ? "animate-pulse bg-amber-300" : runError || (exitCode !== null && exitCode !== 0) ? "bg-rose-300" : "bg-emerald-300"}`} />
            {browserLanguages.has(activeTab) ? "Browser preview" : "Isolated runner"}
          </p>
        </div>

        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="min-w-0 border-b border-emerald-950/15 dark:border-white/10 lg:border-b-0 lg:border-r">
            <div role="tablist" aria-label="Code files and languages" className="flex min-w-0 overflow-x-auto border-b border-white/10 bg-[#24352d] px-2 sm:px-3">
              {editorTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`code-tab-${courseId}-${chapterId}-${tab}`}
                  aria-controls={`code-panel-${courseId}-${chapterId}`}
                  aria-selected={activeTab === tab}
                  onClick={() => selectLanguage(tab)}
                  disabled={isRunning}
                  className={`relative min-h-12 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-emerald-200 disabled:cursor-wait disabled:opacity-60 sm:px-4 ${
                    activeTab === tab
                      ? "border-emerald-300 bg-[#1d2c25] font-semibold text-white"
                      : "border-transparent text-emerald-50/65 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`grid h-5 w-5 place-items-center border text-[9px] font-bold uppercase tracking-tight ${
                        activeTab === tab
                          ? "border-emerald-200/40 bg-emerald-200/15 text-emerald-100"
                          : "border-white/15 text-emerald-50/65"
                      }`}
                    >
                      {tab === "javascript" ? "JS" : tab === "python" ? "PY" : tab === "html" ? "HT" : tab === "css" ? "CS" : tab.toUpperCase()}
                    </span>
                    <span>{filenames[tab]}</span>
                    {activeTab === tab && <span className="sr-only"> (current language)</span>}
                  </span>
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`code-panel-${courseId}-${chapterId}`}
              aria-labelledby={`code-tab-${courseId}-${chapterId}-${activeTab}`}
              className="flex min-w-0 bg-[#17211d] text-sm leading-6 text-emerald-50"
            >
              <pre aria-hidden="true" className="w-12 shrink-0 overflow-hidden border-r border-white/10 py-4 pr-3 text-right font-mono text-xs leading-6 text-emerald-50/35 select-none">
                <span style={{ display: "block", transform: `translateY(-${editorScrollTop}px)` }}>
                  {Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}
                </span>
              </pre>
              <label className="sr-only" htmlFor={`code-input-${courseId}-${chapterId}`}>
                {tabLabels[activeTab]} code
              </label>
              <textarea
                id={`code-input-${courseId}-${chapterId}`}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                wrap="off"
                value={code[activeTab]}
                onChange={(event) => setCode((previous) => ({ ...previous, [activeTab]: event.target.value }))}
                onScroll={(event) => setEditorScrollTop(event.currentTarget.scrollTop)}
                rows={16}
                className="block min-h-80 min-w-0 flex-1 resize-y overflow-auto bg-transparent py-4 pl-4 pr-5 font-mono text-[13px] leading-6 text-emerald-50 caret-emerald-200 outline-none selection:bg-emerald-300/25 placeholder:text-emerald-50/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-200"
              />
            </div>
            <div className="flex min-h-9 items-center justify-between gap-3 border-t border-white/10 bg-[#1d2c25] px-3 text-[11px] text-emerald-50/55 sm:px-4">
              <span>{tabLabels[activeTab]} · UTF-8</span>
              <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col bg-[#f8f7f1] dark:bg-[#1b2923]">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-emerald-950/15 px-4 dark:border-white/10">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-950 dark:text-emerald-100">
                {browserLanguages.has(activeTab) ? "Live preview" : "Program output"}
              </h3>
              <span className={`inline-flex items-center gap-2 text-xs tabular-nums ${
                runError || (exitCode !== null && exitCode !== 0)
                  ? "text-rose-800 dark:text-rose-200"
                  : "text-emerald-900/70 dark:text-emerald-100/70"
              }`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${
                  isRunning ? "animate-pulse bg-amber-500" :
                    runError || (exitCode !== null && exitCode !== 0) ? "bg-rose-600 dark:bg-rose-300" :
                      exitCode === 0 ? "bg-emerald-700 dark:bg-emerald-300" : "bg-zinc-400"
                }`} />
                {statusText}
              </span>
            </div>

            <div className="min-h-64 flex-1 bg-white dark:bg-[#17211d]">
              {browserLanguages.has(activeTab) && previewDocument ? (
                <iframe
                  key={runVersion}
                  ref={frameRef}
                  title="Code practice preview"
                  srcDoc={previewDocument}
                  sandbox="allow-scripts"
                  referrerPolicy="no-referrer"
                  className="block h-80 w-full bg-white"
                />
              ) : browserLanguages.has(activeTab) ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
                  <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">Your preview appears here</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Run your code to see the result.</p>
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
                  <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">Program output appears here</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Run your program to see its result below.</p>
                </div>
              )}
            </div>

            <div className="border-t border-emerald-950/15 bg-[#17211d] dark:border-white/10">
              <div className="flex min-h-10 items-center justify-between gap-3 border-b border-white/10 px-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-50/75">Console</h3>
                <span className="text-[11px] text-emerald-50/45">Output</span>
              </div>
              <div aria-live="polite" className="min-h-20 max-h-40 overflow-auto px-4 py-3 font-mono text-xs leading-5 text-emerald-50">
                {output.length ? output.map((line, index) => (
                  <p key={`${index}-${line.text}`} className={`whitespace-pre-wrap break-words ${line.kind === "error" ? "text-rose-300" : line.kind === "warn" ? "text-amber-200" : ""}`}>
                    {line.kind !== "log" && <span className="mr-2 uppercase text-emerald-50/45">{line.kind}</span>}
                    {line.text}
                  </p>
                )) : (
                  <p className="text-emerald-50/45">{isRunning ? "Waiting for the program to finish…" : "No output yet. Run your code to see messages here."}</p>
                )}
              </div>
              {!isRunning && exitCode !== null && (
                <p role="status" className={`border-t border-white/10 px-4 py-2 text-xs ${exitCode === 0 ? "text-emerald-200" : "text-rose-200"}`}>
                  Program exited with code {exitCode}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
