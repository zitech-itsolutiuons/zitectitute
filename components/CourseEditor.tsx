"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseChapterSections, replaceChapterSection } from "@/lib/chapterSections";
import { createChapterVideoMarker, getInlineChapterVideoUrls, parseChapterEditorBlocks, resolveChapterVideo, serializeChapterEditorBlocks, splitChapterVideo, type ChapterEditorBlock } from "@/lib/chapterVideo";

export type Q = { question: string; options: string[]; correctIndex: number; explanation: string };
export type Ch = { id: string; title: string; contentMd: string; videoUrl: string; quiz: Q[] };
export type FinalAssessmentData = {
  objectiveQuestions: Q[];
  theoryQuestions: { question: string; sampleAnswer: string; gradingPoints: string[] }[];
};

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const line = "border border-blue-200";
const soft = "border border-blue-100 bg-blue-50/20";
const btn = `${line} px-3 py-1.5 text-sm hover:bg-blue-50 disabled:opacity-40 ${focus}`;
const solid = `border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-700 ${focus}`;
const field = `block w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`;

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  const content = [...node.childNodes].map(inlineMarkdown).join("");
  switch (node.tagName) {
    case "BR": return "  \n";
    case "STRONG":
    case "B": return `**${content}**`;
    case "EM":
    case "I": return `*${content}*`;
    case "DEL":
    case "S": return `~~${content}~~`;
    case "CODE": return `\`${content.replace(/`/g, "\\`")}\``;
    case "A": {
      const href = node.getAttribute("href") ?? "";
      return href ? `[${content}](${cleanEditorUrl(href)}${node.title ? ` "${node.title}"` : ""})` : content;
    }
    case "IMG": {
      const src = node.getAttribute("src") ?? "";
      return src ? `![${node.getAttribute("alt") ?? ""}](${cleanEditorUrl(src)}${node.title ? ` "${node.title}"` : ""})` : "";
    }
    default: return content;
  }
}

function cleanEditorUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin === window.location.origin && /^\/api\/courses\/[a-f\d]{24}\/media\/\d+$/i.test(url.pathname)) {
      return url.pathname;
    }
    return url.origin === window.location.origin && value.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : value;
  } catch {
    return value;
  }
}

function listMarkdown(list: HTMLElement, depth = 0): string {
  const ordered = list.tagName === "OL";
  const start = Number(list.getAttribute("start") ?? "1");
  return [...list.children].filter((child) => child.tagName === "LI").map((item, index) => {
    const element = item as HTMLElement;
    const nestedLists = [...element.children].filter((child) => child.tagName === "UL" || child.tagName === "OL") as HTMLElement[];
    const content = [...element.childNodes]
      .filter((child) => !(child instanceof HTMLElement && (child.tagName === "UL" || child.tagName === "OL")))
      .map(inlineMarkdown)
      .join("")
      .trim();
    const prefix = ordered ? `${start + index}. ` : "- ";
    const nested = nestedLists.map((nestedList) => listMarkdown(nestedList, depth + 1)).join("\n");
    return `${"  ".repeat(depth)}${prefix}${content}${nested ? `\n${nested}` : ""}`;
  }).join("\n");
}

function blockMarkdown(node: Node): string {
  if (!(node instanceof HTMLElement)) return inlineMarkdown(node).trim();
  const content = [...node.childNodes].map(inlineMarkdown).join("").trim();
  if (/^H[1-6]$/.test(node.tagName)) {
    const level = Number(node.tagName.slice(1));
    return `${"#".repeat(level)} ${content}`;
  }
  if (node.tagName === "P") return content;
  if (node.tagName === "UL" || node.tagName === "OL") return listMarkdown(node);
  if (node.tagName === "BLOCKQUOTE") {
    const quote = [...node.childNodes].map(blockMarkdown).filter(Boolean).join("\n\n");
    return quote.split("\n").map((line) => `> ${line}`).join("\n");
  }
  if (node.tagName === "PRE") {
    const code = node.querySelector("code");
    const language = [...(code?.classList ?? [])].find((name) => name.startsWith("language-"))?.slice(9) ?? "";
    const text = (code ?? node).textContent ?? "";
    const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)));
    return `${fence}${language}\n${text.replace(/\n$/, "")}\n${fence}`;
  }
  if (node.tagName === "HR") return "---";
  if (node.tagName === "TABLE") {
    const rows = [...node.querySelectorAll("tr")].map((row) =>
      [...row.querySelectorAll(":scope > th, :scope > td")].map((cell) =>
        [...cell.childNodes].map(inlineMarkdown).join("").trim().replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
      )
    );
    if (!rows.length) return "";
    const separator = rows[0].map(() => "---");
    return [rows[0], separator, ...rows.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
  }
  return [...node.childNodes].map(blockMarkdown).filter(Boolean).join("\n\n") || content;
}

function markdownFromEditor(root: HTMLElement) {
  return [...root.childNodes].map(blockMarkdown).filter(Boolean).join("\n\n").trim();
}

async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("The save timed out. Check your connection, then reload the course to confirm whether it was saved.");
    }
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data as T;
}

function RichTextSection({
  content,
  sectionNumber,
  label,
  placeholder,
  onChange,
  onEditing,
}: {
  content: string;
  sectionNumber: number;
  label?: string;
  placeholder?: string;
  onChange: (content: string) => void;
  onEditing: (editing: boolean) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hasEditedRef = useRef(false);
  const [hasContent, setHasContent] = useState(Boolean(content.trim()));
  useEffect(() => setHasContent(Boolean(content.trim())), [content]);
  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    hasEditedRef.current = true;
    setHasContent(Boolean(editorRef.current?.innerText.trim()));
    onEditing(true);
  };

  const controlGroups: {
    label: string;
    controls: { label: string; command: string; value?: string }[];
  }[] = [
    {
      label: "Text structure",
      controls: [
        { label: "Heading", command: "formatBlock", value: "h4" },
        { label: "Subheading", command: "formatBlock", value: "h5" },
      ],
    },
    {
      label: "Text emphasis",
      controls: [
        { label: "Bold", command: "bold" },
        { label: "Italic", command: "italic" },
      ],
    },
    {
      label: "Content blocks",
      controls: [
        { label: "Bulleted list", command: "insertUnorderedList" },
        { label: "Numbered list", command: "insertOrderedList" },
        { label: "Quote", command: "formatBlock", value: "blockquote" },
        { label: "Code block", command: "formatBlock", value: "pre" },
      ],
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]" aria-label={`Text editor for ${label ?? `section ${sectionNumber}`}`}>
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Text formatting</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Select text to style it, or choose a block format.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3">
        {controlGroups.map((group) => (
          <div key={group.label} role="group" aria-label={group.label} className="flex flex-wrap items-center gap-1.5">
            {group.controls.map((control) => (
              <button
                key={control.label}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(control.command, control.value)}
                aria-label={control.label}
                title={control.label}
                className={`min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] ${focus}`}
              >
                {control.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-label={label ?? `Write lesson text, section ${sectionNumber}`}
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
          }}
          onInput={(event) => {
            hasEditedRef.current = true;
            setHasContent(Boolean(event.currentTarget.innerText.trim()));
            onEditing(true);
          }}
          onBlur={(event) => {
            if (hasEditedRef.current) {
              const markdown = markdownFromEditor(event.currentTarget);
              setHasContent(Boolean(markdown));
              onChange(markdown);
              hasEditedRef.current = false;
            }
            onEditing(false);
          }}
          className="lesson-rich-text-editor prose prose-zinc min-h-[20rem] max-w-none bg-[var(--surface)] px-5 py-6 font-serif leading-7 text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)] prose-headings:font-sans prose-headings:font-semibold prose-h4:mt-7 prose-h4:text-xl prose-h5:mt-5 prose-h5:text-lg prose-blockquote:border-l prose-blockquote:pl-4 prose-pre:rounded-md prose-pre:border"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {!hasContent && (
          <p aria-hidden="true" className="pointer-events-none absolute left-5 top-5 text-sm leading-7 text-zinc-500">
            {placeholder ?? "Write or paste lesson text here. Start a new paragraph by pressing Enter."}
          </p>
        )}
      </div>
    </section>
  );
}

export default function CourseEditor({
  courseId,
  initialTitle,
  initialDescription,
  initialCodePracticeEnabled,
  canManageCodePractice,
  isVideoCourse,
  initialChapters,
  initialFinalAssessment,
}: {
  courseId: string;
  initialTitle: string;
  initialDescription: string;
  initialCodePracticeEnabled: boolean;
  canManageCodePractice: boolean;
  isVideoCourse: boolean;
  initialChapters: Ch[];
  initialFinalAssessment?: FinalAssessmentData | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Ch[]>(initialChapters); // last saved state, in course order
  const [drafts, setDrafts] = useState<Record<string, Ch>>({}); // unsaved edits by chapter id
  const [sel, setSel] = useState(initialChapters[0].id);
  const [tab, setTab] = useState<"lessons" | "write" | "preview" | "quiz">(isVideoCourse ? "lessons" : "write");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [guidance, setGuidance] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [codePracticeEnabled, setCodePracticeEnabled] = useState(initialCodePracticeEnabled);
  const [savedCodePracticeEnabled, setSavedCodePracticeEnabled] = useState(initialCodePracticeEnabled);
  const [finalAssessment, setFinalAssessment] = useState(initialFinalAssessment ?? null);
  const [hasRichTextEdits, setHasRichTextEdits] = useState(false);

  const savedCh = saved.find((c) => c.id === sel)!;
  const cur = drafts[sel] ?? savedCh;
  const isDirty = (id: string) => id in drafts && JSON.stringify(drafts[id]) !== JSON.stringify(saved.find((c) => c.id === id));
  const anyDirty = Object.keys(drafts).some(isDirty) || hasRichTextEdits;

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const change = (patch: Partial<Ch>) => setDrafts((d) => ({ ...d, [sel]: { ...cur, ...patch } }));

  const flow = parseChapterEditorBlocks(cur.contentMd, cur.videoUrl);
  const lessons = parseChapterSections(cur.contentMd);
  const activeLessonIndex = Math.min(lessonIndex, lessons.length - 1);
  const activeLesson = lessons[activeLessonIndex];
  const lessonVideoUrls = [
    ...(activeLessonIndex === 0 && cur.videoUrl ? [cur.videoUrl] : []),
    ...getInlineChapterVideoUrls(activeLesson.contentMd),
  ];
  const hasInvalidVideo = flow.some((block) => block.kind === "video" && !resolveChapterVideo(block.url));
  const updateFlow = (blocks: ChapterEditorBlock[]) => change({
    contentMd: serializeChapterEditorBlocks(blocks),
    videoUrl: "",
  });
  const addTextSection = (afterIndex = flow.length - 1) => {
    const blocks = [...flow];
    blocks.splice(afterIndex + 1, 0, { kind: "text", key: "new-text", content: "" });
    updateFlow(blocks);
  };
  const addVideoSection = (afterIndex: number) => {
    const blocks = [...flow];
    blocks.splice(afterIndex + 1, 0, { kind: "video", key: "new-video", url: "" });
    updateFlow(blocks);
    requestAnimationFrame(() => document.getElementById(`video-url-${sel}-${afterIndex + 1}`)?.focus());
  };
  const moveFlowBlock = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= flow.length) return;
    const blocks = [...flow];
    [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
    updateFlow(blocks);
  };
  const removeFlowBlock = (index: number) => {
    const block = flow[index];
    if (block.kind === "text" && block.content.trim() && !window.confirm("Remove this text section and its contents?")) return;
    const blocks = flow.filter((_, blockIndex) => blockIndex !== index);
    if (!blocks.length) blocks.push({ kind: "text", key: "text-0", content: "" });
    updateFlow(blocks);
  };
  const updateLesson = (patch: { title?: string; contentMd?: string }) => {
    const nextTitle = patch.title ?? activeLesson.title;
    const nextContent = patch.contentMd ?? activeLesson.contentMd;
    change({
      contentMd: replaceChapterSection(cur.contentMd, activeLessonIndex, nextTitle, nextContent),
    });
  };
  const addLessonVideo = () =>
    run("lesson-video", async () => {
      if (!resolveChapterVideo(lessonVideoUrl)) return;
      const lessonText = activeLesson.contentMd
        .replace(/\{\{chapter-video(?::[^{}\r\n]*)?\}\}|\{\{chapter-section\}\}/g, "")
        .trim();
      const nextContentMd = replaceChapterSection(
        cur.contentMd,
        activeLessonIndex,
        activeLesson.title,
        [lessonText, ...lessonVideoUrls.map((url) => createChapterVideoMarker(url)), createChapterVideoMarker(lessonVideoUrl)]
          .filter(Boolean)
          .join("\n\n"),
        false
      );
      const nextVideoUrl = activeLessonIndex === 0 ? "" : cur.videoUrl;
      const persistedChapter = { ...savedCh, contentMd: nextContentMd, videoUrl: nextVideoUrl };
      await api(`/api/chapters/${sel}`, "PATCH", { contentMd: nextContentMd, videoUrl: nextVideoUrl });
      setSaved((current) => current.map((chapter) => chapter.id === sel
        ? { ...chapter, contentMd: nextContentMd, videoUrl: nextVideoUrl }
        : chapter));
      setDrafts((current) => {
        const draft = current[sel];
        if (!draft) return current;
        const updated = { ...draft, contentMd: nextContentMd, videoUrl: nextVideoUrl };
        if (JSON.stringify(updated) === JSON.stringify(persistedChapter)) {
          const { [sel]: _saved, ...rest } = current;
          return rest;
        }
        return { ...current, [sel]: updated };
      });
      setLessonVideoUrl("");
      return "Video saved to this lesson.";
    });
  const updateLessonVideos = (urls: string[]) => {
    const lessonText = activeLesson.contentMd
      .replace(/\{\{chapter-video(?::[^{}\r\n]*)?\}\}|\{\{chapter-section\}\}/g, "")
      .trim();
    const contentMd = [
      lessonText,
      ...urls.map((url) => createChapterVideoMarker(url)),
    ].filter(Boolean).join("\n\n");
    change({
      contentMd: replaceChapterSection(cur.contentMd, activeLessonIndex, activeLesson.title, contentMd, false),
      videoUrl: activeLessonIndex === 0 ? "" : cur.videoUrl,
    });
  };

  async function run(name: string, fn: () => Promise<string | void>) {
    setBusy(name);
    setNote(null);
    try {
      const text = await fn();
      if (text) setNote({ ok: true, text });
    } catch (err) {
      setNote({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const saveChapter = () =>
    run("save", async () => {
      const d = drafts[sel];
      if (!d) return "Nothing to save.";
      if (d.title !== savedCh.title || d.contentMd !== savedCh.contentMd || d.videoUrl !== savedCh.videoUrl)
        await api(`/api/chapters/${sel}`, "PATCH", { title: d.title, contentMd: d.contentMd, videoUrl: d.videoUrl });
      if (JSON.stringify(d.quiz) !== JSON.stringify(savedCh.quiz)) await api(`/api/chapters/${sel}/quiz`, "PUT", { questions: d.quiz });
      setSaved((l) => l.map((c) => (c.id === sel ? d : c)));
      setDrafts(({ [sel]: _drop, ...rest }) => rest);
      return "Saved.";
    });

  const regenerate = (target: "lecture" | "quiz") =>
    run(target, async () => {
      const r = await api<{ contentMd?: string; questions?: Q[] }>(`/api/chapters/${sel}/regenerate`, "POST", {
        target,
        guidance: guidance || undefined,
        contentMd: target === "quiz" ? cur.contentMd : undefined,
      });
      if (r.contentMd) {
        change({ contentMd: r.contentMd });
        setTab("write");
      }
      if (r.questions) {
        change({ quiz: r.questions });
        setTab("quiz");
      }
      return "Generated. Review it, then choose Save changes. Nothing is saved until you do.";
    });

  const move = (i: number, dir: -1 | 1) =>
    run("move", async () => {
      const order = saved.map((c) => c.id);
      [order[i], order[i + dir]] = [order[i + dir], order[i]];
      await api(`/api/courses/${courseId}/chapters`, "PUT", { order });
      setSaved((l) => order.map((id) => l.find((c) => c.id === id)!));
    });

  const addChapter = () =>
    run("add", async () => {
      const ch = await api<Ch>(`/api/courses/${courseId}/chapters`, "POST", {});
      setSaved((l) => [...l, ch]);
      setSel(ch.id);
      setLessonIndex(0);
      setLessonVideoUrl("");
      setTab(isVideoCourse ? "lessons" : "write");
    });

  const removeChapter = (id: string) => {
    if (!confirm("Delete this module, its quiz and all student progress on it?")) return;
    run("delete", async () => {
      await api(`/api/chapters/${id}`, "DELETE");
      const rest = saved.filter((c) => c.id !== id);
      setSaved(rest);
      setDrafts(({ [id]: _drop, ...others }) => others);
      if (sel === id) setSel(rest[0].id);
    });
  };

  const saveDetails = () =>
    run("details", async () => {
      await api(`/api/courses/${courseId}`, "PATCH", { title, description });
      return "Course details saved.";
    });

  const saveCodePractice = () =>
    run("code-practice", async () => {
      await api(`/api/courses/${courseId}`, "PATCH", { codePracticeEnabled });
      setSavedCodePracticeEnabled(codePracticeEnabled);
      return codePracticeEnabled
        ? "The code practice workspace is enabled for this course."
        : "The code practice workspace is disabled for this course.";
    });

  const deleteCourse = () => {
    if (!confirm("Delete this whole course, including every student's progress? This can't be undone.")) return;
    run("course", async () => {
      await api(`/api/courses/${courseId}`, "DELETE");
      router.push("/courses");
    });
  };

  const setQuiz = (quiz: Q[]) => change({ quiz });

  const generateFinalAssessment = () =>
    run("final-assessment", async () => {
      const assessment = await api<FinalAssessmentData>(`/api/courses/${courseId}/final-assessment`, "POST", {});
      setFinalAssessment(assessment);
      return "Course final assessment generated and saved.";
    });

  return (
    <div className="space-y-10">
      <div className="grid gap-8 md:grid-cols-[18rem_1fr]">
        <aside className="space-y-8">
          <section aria-labelledby="details-h" className="space-y-3">
            <h2 id="details-h" className="text-sm font-semibold">Course details</h2>
            <input aria-label="Course title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={field} />
            <textarea aria-label="Course description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className={field} />
            <button type="button" onClick={saveDetails} disabled={busy !== null} className={btn}>Save details</button>
          </section>

          {canManageCodePractice && (
            <section aria-labelledby="code-practice-setting-heading" className={`${soft} space-y-3 p-4`}>
              <div>
                <h2 id="code-practice-setting-heading" className="text-sm font-semibold">Code practice</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  Add an HTML, CSS, and JavaScript workspace to every module in this course.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={codePracticeEnabled}
                  onChange={(event) => setCodePracticeEnabled(event.target.checked)}
                  disabled={busy !== null}
                  className="mt-0.5 accent-blue-700"
                />
                Enable student code practice
              </label>
              <button
                type="button"
                onClick={saveCodePractice}
                disabled={busy !== null || codePracticeEnabled === savedCodePracticeEnabled}
                className={btn}
              >
                {busy === "code-practice" ? "Saving..." : "Save code practice setting"}
              </button>
            </section>
          )}

          <section aria-labelledby="chapters-h">
            <h2 id="chapters-h" className="mb-3 text-sm font-semibold">{isVideoCourse ? "Lessons" : "Modules"}</h2>
            <ol className={`${line}`}>
              {saved.map((c, i) => (
                <li key={c.id} className="flex items-stretch border-0 border-b border-zinc-300 last:border-b-0 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSel(c.id);
                      setLessonIndex(0);
                      setLessonVideoUrl("");
                    }}
                    aria-current={c.id === sel ? "true" : undefined}
                    className={`min-w-0 flex-1 px-3 py-2 text-left text-sm ${focus} ${c.id === sel ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                  >
                    <span className="block truncate">{i + 1}. {(drafts[c.id] ?? c).title || `Untitled ${isVideoCourse ? "lesson" : "module"}`}</span>
                    {(isDirty(c.id) || (c.id === sel && hasRichTextEdits)) && <span className="text-xs opacity-70">Unsaved changes</span>}
                  </button>
                  <div className="flex flex-col border-0 border-l border-zinc-300 dark:border-zinc-800">
                    <button type="button" disabled={i === 0 || busy !== null} onClick={() => move(i, -1)} aria-label={`Move module ${i + 1} up`} className="px-2 text-xs hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900">▲</button>
                    <button type="button" disabled={i === saved.length - 1 || busy !== null} onClick={() => move(i, 1)} aria-label={`Move module ${i + 1} down`} className="px-2 text-xs hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900">▼</button>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" onClick={addChapter} disabled={busy !== null} className={`${btn} mt-3`}>Add {isVideoCourse ? "lesson" : "module"}</button>
          </section>
        </aside>

        <section aria-label={isVideoCourse ? "Lesson editor" : "Module editor"} className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="ch-title" className="text-sm font-medium">{isVideoCourse ? "Lesson title" : "Module title"}</label>
              <input id="ch-title" value={cur.title} onChange={(e) => change({ title: e.target.value })} maxLength={200} className={`${field} mt-1`} />
            </div>
            <button type="button" onClick={saveChapter} disabled={busy !== null || (!isDirty(sel) && !hasRichTextEdits) || hasInvalidVideo} className={solid}>
              {busy === "save" ? "Saving" : "Save changes"}
            </button>
            <button type="button" onClick={() => removeChapter(sel)} disabled={busy !== null || saved.length <= 1} className={btn}>Delete {isVideoCourse ? "lesson" : "module"}</button>
          </div>

          <section className={`${soft} space-y-4 p-4`} aria-labelledby="final-assessment-heading">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 id="final-assessment-heading" className="text-sm font-semibold">Course final assessment</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">A comprehensive exam drawn from every module, with objective questions and written theory prompts.</p>
                {finalAssessment && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    {finalAssessment.objectiveQuestions.length} objective questions · {finalAssessment.theoryQuestions.length} theory questions
                  </p>
                )}
              </div>
              <button type="button" onClick={generateFinalAssessment} disabled={busy !== null} className={`${btn} shrink-0`}>
                {busy === "final-assessment" ? "Generating assessment..." : finalAssessment ? "Regenerate final assessment" : "Generate final assessment"}
              </button>
            </div>
            {finalAssessment ? (
              <details className="border-t border-blue-100 pt-3">
                <summary className="w-fit cursor-pointer text-sm font-medium text-blue-800 hover:text-blue-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  Review assessment questions and answers
                </summary>
                <div className="mt-4 space-y-6 text-sm">
                  <section>
                    <h3 className="font-semibold">Objective questions</h3>
                    <ol className="mt-2 list-decimal space-y-4 pl-5">
                      {finalAssessment.objectiveQuestions.map((question, index) => (
                        <li key={index} className="pl-1">
                          <p className="font-medium">{question.question}</p>
                          <p className="mt-1 text-xs text-zinc-500">Correct answer: {question.options[question.correctIndex]}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-600">{question.explanation}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="border-t border-blue-100 pt-4">
                    <h3 className="font-semibold">Theory questions</h3>
                    <ol className="mt-2 list-decimal space-y-4 pl-5">
                      {finalAssessment.theoryQuestions.map((question, index) => (
                        <li key={index} className="pl-1">
                          <p className="font-medium">{question.question}</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-600">Sample answer: {question.sampleAnswer}</p>
                          <ul className="mt-1 list-disc pl-4 text-xs leading-5 text-zinc-500">
                            {question.gradingPoints.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>
              </details>
            ) : (
              <p className="border-t border-blue-100 pt-3 text-xs text-zinc-500">No course final assessment has been generated yet.</p>
            )}
          </section>

          <div className={`${soft} space-y-3 p-4`}>
            <label htmlFor="guidance" className="text-sm font-medium">Regenerate with the model</label>
            <input id="guidance" value={guidance} onChange={(e) => setGuidance(e.target.value)} maxLength={300} placeholder="Optional guidance, e.g. more worked examples, simpler wording" className={field} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => regenerate("lecture")} disabled={busy !== null} className={btn}>{busy === "lecture" ? "Writing module" : "Regenerate module"}</button>
              <button type="button" onClick={() => regenerate("quiz")} disabled={busy !== null} className={btn}>{busy === "quiz" ? "Writing quiz" : "Regenerate quiz from this module"}</button>
            </div>
            <p className="text-xs text-zinc-500">The result appears here as an unsaved draft. Your saved version stays untouched until you save.</p>
          </div>

          {note && (
            <p role={note.ok ? "status" : "alert"} className="border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">{note.text}</p>
          )}

          <div role="tablist" aria-label="Chapter and lesson editor views" className="flex">
            {(["lessons", "write", "preview", "quiz"] as const).map((k, i) => {
              const label = k === "lessons" ? `Lessons (${lessons.length})` : k === "write" ? "Module content" : k === "preview" ? "Preview" : `Quiz (${cur.quiz.length})`;
              return (
                <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`${line} px-4 py-1.5 text-sm ${i > 0 ? "-ml-px" : ""} ${focus} ${tab === k ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "lessons" && (
            <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
              <nav aria-label="Lessons in this chapter">
                <h2 className="mb-3 text-sm font-semibold">Edit by lesson</h2>
                <ol className={`${line}`}>
                  {lessons.map((lesson, index) => (
                    <li key={lesson.id} className="border-b border-zinc-300 last:border-b-0 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          setLessonIndex(index);
                          setLessonVideoUrl("");
                        }}
                        aria-current={activeLessonIndex === index ? "true" : undefined}
                        className={`min-h-11 w-full px-3 py-2 text-left text-sm ${focus} ${activeLessonIndex === index ? "bg-blue-600 text-white" : "hover:bg-blue-50"}`}
                      >
                        <span className="block truncate">{index + 1}. {lesson.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
              <section aria-label={`Edit lesson ${activeLessonIndex + 1}`} className="min-w-0 space-y-5">
                <div>
                  <h2 className="text-base font-semibold">Lesson {activeLessonIndex + 1}</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Edit this lesson without changing the other lessons in the chapter. Save changes above when you’re done.
                  </p>
                </div>
                <label htmlFor="lesson-title" className="block text-sm font-medium">
                  Lesson title
                  <input
                    id="lesson-title"
                    value={activeLesson.title}
                    onChange={(event) => updateLesson({ title: event.target.value })}
                    maxLength={200}
                    className={`${field} mt-1`}
                  />
                </label>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Lesson content</h3>
                  <RichTextSection
                    key={`${sel}-${activeLessonIndex}`}
                    content={activeLesson.contentMd.replace(/\{\{chapter-video(?::[^{}\r\n]*)?\}\}|\{\{chapter-section\}\}/g, "").trim()}
                    sectionNumber={activeLessonIndex + 1}
                    label={`Write content for ${activeLesson.title}`}
                    placeholder="Write the lesson here. Select text to format it, or choose a style and start typing."
                    onEditing={setHasRichTextEdits}
                    onChange={(contentMd) => updateLesson({ contentMd })}
                  />
                  <p className="text-xs leading-5 text-zinc-500">
                    Select existing text before applying a format. Video links remain attached to this lesson.
                  </p>
                </div>
                <section aria-labelledby="lesson-video-heading" className={`${soft} space-y-3 p-4`}>
                  <div>
                    <h3 id="lesson-video-heading" className="text-sm font-semibold">Lesson videos</h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Videos added here appear in this lesson only.</p>
                  </div>
                  {lessonVideoUrls.map((url, index) => (
                    <div key={`${activeLesson.id}-video-${index}`} className="space-y-2">
                      <div className="flex items-end gap-2">
                        <label htmlFor={`lesson-video-${activeLessonIndex}-${index}`} className="min-w-0 flex-1 text-sm font-medium">
                          Video {index + 1} link
                          <input
                            id={`lesson-video-${activeLessonIndex}-${index}`}
                            type="url"
                            value={url}
                            onChange={(event) => updateLessonVideos(lessonVideoUrls.map((current, videoIndex) => videoIndex === index ? event.target.value : current))}
                            maxLength={2000}
                            aria-invalid={!resolveChapterVideo(url)}
                            className={`${field} mt-1`}
                          />
                        </label>
                        <button type="button" onClick={() => updateLessonVideos(lessonVideoUrls.filter((_, videoIndex) => videoIndex !== index))} className={btn}>
                          Remove
                        </button>
                      </div>
                      {url && !resolveChapterVideo(url) ? (
                        <p role="alert" className="text-sm text-rose-700">Use a supported YouTube, Vimeo, MP4, WebM, or Ogg video link.</p>
                      ) : resolveChapterVideo(url) ? (
                        <div className="aspect-video overflow-hidden border border-blue-200 bg-black">
                          <ChapterVideo url={url} title={`${activeLesson.title} video ${index + 1}`} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <label htmlFor="lesson-video-url" className="block text-sm font-medium">
                    Add a video link
                    <input
                      id="lesson-video-url"
                      type="url"
                      value={lessonVideoUrl}
                      onChange={(event) => setLessonVideoUrl(event.target.value)}
                      maxLength={2000}
                      placeholder="YouTube, Vimeo, or a direct video link"
                      aria-invalid={Boolean(lessonVideoUrl && !resolveChapterVideo(lessonVideoUrl))}
                      className={`${field} mt-1`}
                    />
                  </label>
                  {lessonVideoUrl && !resolveChapterVideo(lessonVideoUrl) && (
                    <p role="alert" className="text-sm text-rose-700">Use a supported YouTube, Vimeo, MP4, WebM, or Ogg video link.</p>
                  )}
                  <button type="button" onClick={addLessonVideo} disabled={busy !== null || !resolveChapterVideo(lessonVideoUrl)} className={btn}>
                    {busy === "lesson-video" ? "Saving video..." : "Add video to lesson"}
                  </button>
                </section>
              </section>
            </div>
          )}

          {tab === "write" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-blue-100 pb-3">
                <div>
                  <h2 className="text-base font-semibold">Build the lesson</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    Add text and video sections in the order learners should see them. Use the writing buttons for common formatting.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => addTextSection()} disabled={busy !== null} className={btn}>Add text section</button>
                  <button type="button" onClick={() => addVideoSection(isVideoCourse ? -1 : flow.length - 1)} disabled={busy !== null} className={btn}>
                    {isVideoCourse ? "Add video to this lesson" : "Add video section"}
                  </button>
                </div>
              </div>
              <ol className="space-y-4">
                {flow.map((block, index) => (
                  <li key={`${block.key}-${index}`} className="relative">
                    {block.kind === "text" ? (
                      <section className={`${soft} space-y-3 p-4`} aria-label={`Text section ${index + 1}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Text section</h3>
                          <div className="flex flex-wrap gap-1">
                            <button type="button" onClick={() => moveFlowBlock(index, -1)} disabled={index === 0 || busy !== null} aria-label={`Move text section ${index + 1} up`} className={btn}>Move up</button>
                            <button type="button" onClick={() => moveFlowBlock(index, 1)} disabled={index === flow.length - 1 || busy !== null} aria-label={`Move text section ${index + 1} down`} className={btn}>Move down</button>
                            <button type="button" onClick={() => removeFlowBlock(index)} disabled={busy !== null || flow.filter((item) => item.kind === "text").length <= 1} className={btn}>Remove section</button>
                          </div>
                        </div>
                        <RichTextSection
                          content={block.content}
                          sectionNumber={index + 1}
                          onEditing={setHasRichTextEdits}
                          onChange={(content) => {
                            const blocks = [...flow];
                            blocks[index] = { ...block, content };
                            updateFlow(blocks);
                          }}
                        />
                      </section>
                    ) : (
                      <section className={`${soft} space-y-3 p-4`} aria-label={`Video section ${index + 1}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Video section</h3>
                            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">This video appears here in the learner’s lesson.</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button type="button" onClick={() => moveFlowBlock(index, -1)} disabled={index === 0 || busy !== null} aria-label={`Move video section ${index + 1} up`} className={btn}>Move up</button>
                            <button type="button" onClick={() => moveFlowBlock(index, 1)} disabled={index === flow.length - 1 || busy !== null} aria-label={`Move video section ${index + 1} down`} className={btn}>Move down</button>
                            <button type="button" onClick={() => removeFlowBlock(index)} disabled={busy !== null} className={btn}>Remove video</button>
                          </div>
                        </div>
                        <label htmlFor={`video-url-${sel}-${index}`} className="block text-sm font-medium">
                          Video link
                          <input
                            id={`video-url-${sel}-${index}`}
                            type="url"
                            value={block.url}
                            onChange={(event) => {
                              const blocks = [...flow];
                              blocks[index] = { ...block, url: event.target.value };
                              updateFlow(blocks);
                            }}
                            maxLength={2000}
                            placeholder="Paste a YouTube, Vimeo, or direct video link"
                            aria-invalid={Boolean(block.url && !resolveChapterVideo(block.url))}
                            className={`${field} mt-1`}
                          />
                        </label>
                        {block.url && !resolveChapterVideo(block.url) ? (
                          <p role="alert" className="text-sm text-rose-700">That link is not supported. Use a YouTube, Vimeo, MP4, WebM or Ogg video link.</p>
                        ) : !block.url ? (
                          <p className="text-xs text-zinc-500">Add a supported video link, or remove this section before saving.</p>
                        ) : (
                          <div className="aspect-video overflow-hidden rounded-md border border-blue-200 bg-black">
                            <ChapterVideo url={block.url} title={cur.title} />
                          </div>
                        )}
                      </section>
                    )}
                    {block.kind === "text" && (
                      <div className="ml-4 mt-3 border-l border-blue-200 pl-4">
                        <button type="button" onClick={() => addVideoSection(index)} disabled={busy !== null} className={`${btn} bg-white dark:bg-slate-900`}>
                          Add video below
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {hasInvalidVideo && (
                <p role="alert" className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Finish each video section with a supported link, or remove any unfinished sections before saving.
                </p>
              )}
            </div>
          )}
          {tab === "preview" && (
            <article className="prose prose-zinc max-w-[68ch] font-serif dark:prose-invert prose-headings:font-sans prose-code:before:content-none prose-code:after:content-none">
              <h1>{cur.title}</h1>
              {splitChapterVideo(cur.contentMd, cur.videoUrl).map((block) => block.kind === "video"
                ? <ChapterVideo key={block.key} url={block.url} title={cur.title} />
                : <ReactMarkdown key={block.key} remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>)}
            </article>
          )}
          {tab === "quiz" && <QuizEditor quiz={cur.quiz} onChange={setQuiz} />}
        </section>
      </div>

      <section className={`${soft} p-5`}>
        <h2 className="text-sm font-semibold">Delete course</h2>
        <p className="mt-1 text-sm text-zinc-500">Removes the course, every module and quiz, and all student progress.</p>
        <button type="button" onClick={deleteCourse} disabled={busy !== null} className={`${btn} mt-3`}>Delete this course</button>
      </section>
    </div>
  );
}

function ChapterVideo({ url, title }: { url: string; title: string }) {
  const source = resolveChapterVideo(url);
  if (!source) return null;
  if (source.kind === "file") {
    return <video className="h-full w-full" controls preload="metadata" src={source.src} aria-label={`${title} video`} />;
  }
  return (
    <iframe
      className="h-full w-full"
      src={source.src}
      title={`${title} video preview`}
      loading="lazy"
      referrerPolicy="origin"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

function QuizEditor({ quiz, onChange }: { quiz: Q[]; onChange: (q: Q[]) => void }) {
  const set = (i: number, patch: Partial<Q>) => onChange(quiz.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  return (
    <div className="space-y-6">
      {quiz.length === 0 && <p className="text-sm text-zinc-500">This module has no quiz. Add a question, or regenerate a quiz from the module.</p>}
      {quiz.map((q, i) => (
        <fieldset key={i} className={`${soft} space-y-3 p-4`}>
          <legend className="px-1 text-sm font-medium">Question {i + 1}</legend>
          <textarea aria-label={`Question ${i + 1}`} value={q.question} onChange={(e) => set(i, { question: e.target.value })} rows={2} className={field} />
          <p className="text-xs text-zinc-500">Select the radio button next to the correct option.</p>
          {q.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => set(i, { correctIndex: oi })} aria-label={`Option ${oi + 1} is correct`} className="h-4 w-4 accent-blue-600" />
              <input aria-label={`Option ${oi + 1}`} value={o} onChange={(e) => set(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} className={field} />
              <button type="button" disabled={q.options.length <= 2} aria-label={`Remove option ${oi + 1}`}
                onClick={() => set(i, { options: q.options.filter((_, k) => k !== oi), correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}
                className={btn}>Remove</button>
            </div>
          ))}
          <textarea aria-label={`Explanation for question ${i + 1}`} placeholder="Explanation shown after the student answers" value={q.explanation} onChange={(e) => set(i, { explanation: e.target.value })} rows={2} className={field} />
          <div className="flex gap-2">
            <button type="button" disabled={q.options.length >= 6} onClick={() => set(i, { options: [...q.options, ""] })} className={btn}>Add option</button>
            <button type="button" onClick={() => onChange(quiz.filter((_, k) => k !== i))} className={btn}>Delete question</button>
          </div>
        </fieldset>
      ))}
      <button type="button" disabled={quiz.length >= 15} onClick={() => onChange([...quiz, { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" }])} className={btn}>Add question</button>
    </div>
  );
}
