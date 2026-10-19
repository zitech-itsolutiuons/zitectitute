"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  courseTitle: string;
  chapterId: string;
  chapterTitle: string;
  initialNote: string;
  onNoteChange: (content: string) => void;
  inline?: boolean;
};

type SaveState = "saved" | "saving" | "error";

const buttonStyle =
  "border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
const soft = "border-zinc-300 dark:border-zinc-700";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeFilename(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "module-notes";
}

function noteLines(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}

export default function ChapterNotes({ courseTitle, chapterId, chapterTitle, initialNote, onNoteChange, inline = false }: Props) {
  const [note, setNote] = useState(initialNote);
  const [open, setOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [exporting, setExporting] = useState<"" | "PDF" | "PNG" | "DOCX">("");
  const [exportError, setExportError] = useState("");
  const noteRef = useRef(initialNote);
  const savedRef = useRef(initialNote);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveNoteRef = useRef<(content: string) => void>(() => {});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const desktop = window.matchMedia("(min-width: 1280px)");
    const syncDialog = () => {
      if (open && !desktop.matches && !dialog.open) dialog.showModal();
      if ((!open || desktop.matches) && dialog.open) dialog.close();
    };
    syncDialog();
    desktop.addEventListener("change", syncDialog);
    return () => desktop.removeEventListener("change", syncDialog);
  }, [open]);

  const saveNote = (content: string, force = false) => {
    if (!force && content === savedRef.current) return;
    setSaveState("saving");
    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        const response = await fetch(`/api/chapters/${chapterId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(result?.error || "Notes could not be saved");
        }
        savedRef.current = content;
        if (noteRef.current === content) setSaveState("saved");
      })
      .catch(() => {
        if (noteRef.current === content) setSaveState("error");
      });
  };
  saveNoteRef.current = (content) => saveNote(content, true);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (noteRef.current !== savedRef.current) saveNoteRef.current(noteRef.current);
  }, []);

  const updateNote = (content: string) => {
    noteRef.current = content;
    setNote(content);
    onNoteChange(content);
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNote(content), 700);
  };

  const exportNotes = async (format: "PDF" | "PNG" | "DOCX") => {
    if (!noteLines(note).length || exporting) return;
    setExporting(format);
    setExportError("");
    try {
      const filename = makeFilename(chapterTitle);
      const lines = noteLines(note);

      if (format === "PDF") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 18;
        let y = 22;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text(chapterTitle, margin, y);
        y += 10;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text(courseTitle, margin, y);
        y += 12;
        pdf.setTextColor(30);
        pdf.setFontSize(12);
        for (const line of lines) {
          const wrapped = pdf.splitTextToSize(`- ${line}`, pageWidth - margin * 2) as string[];
          for (const row of wrapped) {
            if (y > pageHeight - margin) {
              pdf.addPage();
              y = margin;
            }
            pdf.text(row, margin, y);
            y += 7;
          }
          y += 2;
        }
        pdf.save(`${filename}-notes.pdf`);
      } else if (format === "DOCX") {
        const { Document, HeadingLevel, Packer, Paragraph } = await import("docx");
        const document = new Document({
          sections: [{
            children: [
              new Paragraph({ text: chapterTitle, heading: HeadingLevel.TITLE }),
              new Paragraph({ text: courseTitle, heading: HeadingLevel.HEADING_2 }),
              ...lines.map((line) => new Paragraph({ text: line, bullet: { level: 0 }, spacing: { after: 160 } })),
            ],
          }],
        });
        download(await Packer.toBlob(document), `${filename}-notes.docx`);
      } else {
        const canvas = document.createElement("canvas");
        const scale = 2;
        const width = 1200;
        const padding = 80;
        const lineHeight = 42;
        canvas.width = width * scale;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image export is not available in this browser");
        context.scale(scale, scale);
        context.font = "26px Arial, sans-serif";
        const wrappedLines = lines.flatMap((line) => {
          const words = line.split(/\s+/);
          const rows: string[] = [];
          let row = "•";
          for (const word of words) {
            const next = `${row} ${word}`;
            if (context.measureText(next).width > width - padding * 2 && row !== "•") {
              rows.push(row);
              row = `  ${word}`;
            } else {
              row = next;
            }
          }
          rows.push(row);
          return rows;
        });
        const height = padding * 2 + 90 + wrappedLines.length * lineHeight;
        if (height * scale > 32_000) throw new Error("These notes are too long for a single PNG. Shorten them and try again.");
        canvas.height = height * scale;
        context.scale(scale, scale);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#111111";
        context.font = "bold 34px Arial, sans-serif";
        context.fillText(chapterTitle, padding, padding + 24, width - padding * 2);
        context.fillStyle = "#666666";
        context.font = "20px Arial, sans-serif";
        context.fillText(courseTitle, padding, padding + 62, width - padding * 2);
        context.fillStyle = "#171717";
        context.font = "26px Arial, sans-serif";
        wrappedLines.forEach((line, index) => context.fillText(line, padding, padding + 120 + index * lineHeight));
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG could not be created")), "image/png");
        });
        download(blob, `${filename}-notes.png`);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Notes could not be exported");
    } finally {
      setExporting("");
    }
  };

  const retrySave = () => {
    saveNote(noteRef.current, true);
  };

  const renderEditor = (surface: "dialog" | "panel" | "inline") => (
    <section className={`flex min-h-0 flex-col font-sans ${surface === "panel" ? "h-full" : ""}`}>
      <div className={`flex items-start justify-between gap-3 border-b border-zinc-200 pb-2 dark:border-zinc-800 ${surface === "panel" ? "pt-5" : ""} ${surface === "inline" ? "pb-1" : ""}`}>
        <div className="min-w-0">
          <h2 id={`student-notes-title-${chapterId}-${surface}`} className={`${surface === "inline" ? "text-sm" : "text-lg"} font-semibold`}>Your notes</h2>
          {surface !== "inline" && <p id={`student-notes-description-${chapterId}-${surface}`} className="mt-1 truncate text-sm text-zinc-500">
            {chapterTitle} · Private to you
          </p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span role="status" className={`pt-1 text-xs ${saveState === "error" ? "text-red-700 dark:text-red-300" : "text-zinc-500"}`}>
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}
          </span>
          {surface === "dialog" && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notes" className={`p-1 text-zinc-500 hover:text-black dark:hover:text-white ${focus}`}>
              <CloseIcon />
            </button>
          )}
          {surface === "panel" && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notes" className={`p-1 text-zinc-500 hover:text-black dark:hover:text-white ${focus}`}>
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
      <label className="sr-only" htmlFor={`notes-${chapterId}-${surface}`}>Notes for {chapterTitle}</label>
      <textarea
        id={`notes-${chapterId}-${surface}`}
        value={note}
        onChange={(event) => updateNote(event.target.value)}
        maxLength={20_000}
        placeholder={`Capture definitions, ideas, and reminders for ${chapterTitle}…`}
        rows={surface === "panel" ? 10 : surface === "inline" ? 2 : 9}
        className={`mt-2 w-full resize-y border ${soft} bg-transparent px-3 py-2 text-sm leading-5 placeholder:text-zinc-500 ${focus} ${surface === "panel" ? "min-h-48 flex-1 resize-none" : ""} ${surface === "inline" ? "max-h-24 min-h-14 resize-y" : ""}`}
      />
      <div className={`${surface === "inline" ? "mt-1" : "mt-2"} flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500`}>
        <span>{note.length.toLocaleString()} / 20,000 characters</span>
        {saveState === "error" && (
          <button type="button" onClick={retrySave} className="font-semibold text-red-700 underline underline-offset-4 dark:text-red-300">
            Retry saving
          </button>
        )}
      </div>
      <div className={`${surface === "inline" ? "mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800" : "mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800"} ${surface === "panel" ? "mt-auto pb-5" : ""}`}>
        {surface !== "inline" && <p className="mb-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">Download these module notes</p>}
        <div className="flex flex-wrap items-center gap-2">
          {(["PDF", "PNG", "DOCX"] as const).map((format) => (
            <button
              key={format}
              type="button"
              disabled={!noteLines(note).length || Boolean(exporting)}
              onClick={() => void exportNotes(format)}
              className={`${buttonStyle} ${focus}`}
            >
              {exporting === format ? "Preparing…" : format}
            </button>
          ))}
        </div>
        {exportError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{exportError}</p>}
      </div>
    </section>
  );

  if (inline) {
    return (
      <div className="mx-auto w-full py-2 font-sans">
        {renderEditor("inline")}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 ${buttonStyle} ${focus}`}
      >
        <NoteIcon />
        Notes
        {note.trim() && <span aria-label="Notes saved" className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`student-notes-title-${chapterId}-dialog`}
        aria-describedby={`student-notes-description-${chapterId}-dialog`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="fixed inset-0 m-auto max-h-[min(88dvh,760px)] w-[min(640px,calc(100%-2rem))] max-w-none overflow-y-auto border border-zinc-300 bg-white p-0 text-black shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop:bg-black/45 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white xl:hidden"
      >
        <section className="p-5 sm:p-7">
          {renderEditor("dialog")}
        </section>
      </dialog>
      {open && (
        <aside
          aria-label={`Notes for ${chapterTitle}`}
          className="fixed bottom-0 right-0 top-0 z-40 hidden w-80 flex-col overflow-y-auto border-l border-zinc-300 bg-white px-4 text-black dark:border-zinc-800 dark:bg-black dark:text-white xl:flex"
        >
          {renderEditor("panel")}
        </aside>
      )}
    </>
  );
}

function NoteIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
      <path d="M5 2.75h7l4 4v10.5H5a2 2 0 0 1-2-2v-10.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 2.75v4h4M6.5 10h6M6.5 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="none">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
