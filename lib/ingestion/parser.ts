import mammoth from "mammoth";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// pdf-parse's bundled PDF.js is used directly to detect and render image pages.
const pdfjs = require("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js");

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ExtractedImage = { index: number; contentType: string; data: Buffer };
export type ParsedDocument = { text: string; images: ExtractedImage[] };

const MAX_IMAGES = 80;
const IMAGE_OPERATIONS = new Set<number>([
  pdfjs.OPS.paintJpegXObject,
  pdfjs.OPS.paintImageMaskXObject,
  pdfjs.OPS.paintImageMaskXObjectGroup,
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintInlineImageXObjectGroup,
]);

function createPdfCanvas(width: number, height: number) {
  const canvas = createCanvas(width, height);
  return { canvas, context: canvas.getContext("2d") };
}

const pdfCanvasFactory = {
  create: createPdfCanvas,
  reset(canvasAndContext: ReturnType<typeof createPdfCanvas>, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
    canvasAndContext.context = canvasAndContext.canvas.getContext("2d");
  },
  destroy(canvasAndContext: ReturnType<typeof createPdfCanvas>) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  },
};

/** Extract readable text and preserve embedded visuals with stable source markers. */
export async function parseDocumentWithMedia(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument> {
  const images: ExtractedImage[] = [];
  let raw: string;
  switch (mimeType) {
    case "application/pdf": {
      raw = await extractPdf(fileBuffer, images);
      break;
    }
    case DOCX: {
      const result = await mammoth.convertToHtml({ buffer: fileBuffer }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          if (images.length < MAX_IMAGES) {
            const data = await rasterizeImage(await image.readAsBuffer());
            images.push({ index: images.length, contentType: "image/jpeg", data });
            return { src: `course-image:${images.length - 1}` };
          }
          return { src: "" };
        }),
      });
      raw = htmlToMarkedText(result.value);
      break;
    }
    case "text/plain":
    case "text/markdown":
      raw = fileBuffer.toString("utf8");
      break;
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
  const clean = sanitizeText(raw);
  if (clean.length < 200) throw new Error("Document has too little extractable text (scanned PDF?).");
  return { text: clean, images };
}

export async function parseDocument(fileBuffer: Buffer, mimeType: string): Promise<string> {
  return (await parseDocumentWithMedia(fileBuffer, mimeType)).text;
}

async function rasterizeImage(data: Buffer): Promise<Buffer> {
  const image = await loadImage(data);
  const scale = Math.min(1, 1600 / image.width, 1800 / image.height);
  const canvas = createCanvas(Math.max(1, Math.ceil(image.width * scale)), Math.max(1, Math.ceil(image.height * scale)));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toBuffer("image/jpeg", 84);
}

async function extractPdf(fileBuffer: Buffer, images: ExtractedImage[]): Promise<string> {
  pdfjs.disableWorker = true;
  const document = await pdfjs.getDocument({ data: new Uint8Array(fileBuffer) });
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      let previousY: number | undefined;
      let text = "";
      for (const item of textContent.items) {
        if (item.str === undefined) continue;
        if (previousY !== undefined && previousY !== item.transform[5]) text += "\n";
        text += item.str;
        previousY = item.transform[5];
      }

      if (images.length < MAX_IMAGES) {
        const operations = await page.getOperatorList();
        if (operations.fnArray.some((operation: number) => IMAGE_OPERATIONS.has(operation))) {
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(1.5, 1400 / baseViewport.width, 1800 / baseViewport.height);
          const viewport = page.getViewport({ scale });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvasFactory: pdfCanvasFactory }).promise;
          const index = images.length;
          images.push({ index, contentType: "image/jpeg", data: canvas.toBuffer("image/jpeg", 78) });
          text += `\n[COURSE_IMAGE_${index}]`;
        }
      }
      pages.push(text);
    }
  } finally {
    await document.destroy();
  }
  return pages.join("\n\n");
}

function htmlToMarkedText(html: string): string {
  return html
    .replace(/<img\b([^>]*)>/gi, (_, attributes: string) => {
      const source = attributes.match(/\bsrc=["']course-image:(\d+)["']/i);
      if (!source) return "";
      const alt = attributes.match(/\balt=["']([^"']*)["']/i)?.[1]?.trim();
      const description = alt ? `\nSource figure description: ${alt.replace(/[.!?]*$/, ".")}` : "";
      return `\n[COURSE_IMAGE_${source[1]}]${description}\n`;
    })
    .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n\n")
    .replace(/<(br|hr)\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[code.toLowerCase()] ?? entity;
    });
}

const PAGE_NUMBER = /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$|^[-–—]\s*\d{1,4}\s*[-–—]$/i;

export function sanitizeText(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2"); // re-join words hyphenated across lines

  const lines = text.split("\n").map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim());

  // Drop running headers/footers: SHORT lines (<= 50 chars, so hard-wrapped body
  // lines are never caught) without terminal punctuation that repeat 4+ times.
  // Heuristic: it also removes a heading that repeats in every chapter, so tune
  // the thresholds for your documents.
  const freq = new Map<string, number>();
  for (const l of lines) if (l && l.length <= 50) freq.set(l, (freq.get(l) ?? 0) + 1);
  const boilerplate = new Set(
    [...freq].filter(([l, n]) => n >= 4 && !/[.!?:]$/.test(l)).map(([l]) => l)
  );

  // Re-flow hard-wrapped PDF lines into paragraphs.
  const paragraphs: string[] = [];
  let current = "";
  let prev = "";
  for (const l of lines) {
    if (!l) {
      if (current) paragraphs.push(current);
      current = "";
      prev = "";
      continue;
    }
    if (PAGE_NUMBER.test(l) || boilerplate.has(l)) continue;
    if (current && !/[.!?:]$/.test(prev) && prev.length >= 50) current += " " + l;
    else if (current) {
      paragraphs.push(current);
      current = l;
    } else current = l;
    prev = l;
  }
  if (current) paragraphs.push(current);
  return paragraphs.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Chunking: lets the outline model "see" a whole document cheaply.    */
/* ------------------------------------------------------------------ */

export interface Block {
  id: number;
  text: string;
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

/** Paragraph-aligned blocks of ~targetChars. Capped at ~400 blocks per document. */
export function splitIntoBlocks(text: string, targetChars = 1200): Block[] {
  const size = Math.max(targetChars, Math.ceil(text.length / 400));
  const blocks: Block[] = [];
  let buf = "";
  const flush = () => {
    if (buf) blocks.push({ id: blocks.length, text: buf });
    buf = "";
  };
  for (const para of text.split(/\n{2,}/)) {
    // Very long paragraphs are cut on sentence boundaries.
    const pieces = para.length > size * 2 ? para.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [para] : [para];
    for (const piece of pieces) {
      if (buf && buf.length + piece.length > size) flush();
      buf += (buf ? "\n\n" : "") + piece;
    }
  }
  flush();
  return blocks;
}

/**
 * One line per block: "[id] first N chars". The outline model reads this
 * skeleton (a few thousand tokens) instead of the full document (tens of
 * thousands) and answers with block-id ranges. We slice the real text locally.
 */
export function buildSkeleton(blocks: Block[], maxChars = 24_000): string {
  const preview = Math.max(60, Math.floor(maxChars / blocks.length) - 8);
  return blocks.map((b) => `[${b.id}] ${b.text.replace(/\s+/g, " ").slice(0, preview)}`).join("\n");
}
