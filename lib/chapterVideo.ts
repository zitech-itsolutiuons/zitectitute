export type ChapterVideoSource = { kind: "embed" | "file"; src: string };
export const CHAPTER_VIDEO_MARKER = "{{chapter-video}}";
const CHAPTER_SECTION_MARKER = "{{chapter-section}}";
const CHAPTER_EDITOR_MARKER_PATTERN = /\{\{chapter-video(?::([^{}\r\n]*))?\}\}|\{\{chapter-section\}\}/g;
const CHAPTER_VIDEO_PATTERN = /\{\{chapter-video(?::([^{}\r\n]*))?\}\}/g;

export type ChapterContentBlock =
  | { kind: "markdown"; key: string; content: string }
  | { kind: "video"; key: string; url: string };

export type ChapterEditorBlock =
  | { kind: "text"; key: string; content: string }
  | { kind: "video"; key: string; url: string };

export function createChapterVideoMarker(url: string) {
  return `{{chapter-video:${encodeURIComponent(url.trim())}}}`;
}

function decodeVideoMarker(encodedUrl: string | undefined, fallback: string) {
  if (encodedUrl === undefined) return fallback;
  try {
    return decodeURIComponent(encodedUrl);
  } catch {
    return encodedUrl;
  }
}

export function getInlineChapterVideoUrls(contentMd: string) {
  return [...contentMd.matchAll(CHAPTER_VIDEO_PATTERN)]
    .flatMap((match) => {
      if (match[1] === undefined) return [];
      try {
        return [decodeURIComponent(match[1])];
      } catch {
        return [""];
      }
    });
}

export function stripChapterVideoMarkers(contentMd: string) {
  return contentMd
    .replace(CHAPTER_EDITOR_MARKER_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseChapterEditorBlocks(contentMd: string, videoUrl = ""): ChapterEditorBlock[] {
  const blocks: ChapterEditorBlock[] = [];
  let cursor = 0;
  let index = 0;
  let hasLegacyMarker = false;

  let previousWasSectionBoundary = false;
  for (const match of contentMd.matchAll(CHAPTER_EDITOR_MARKER_PATTERN)) {
    const start = match.index ?? cursor;
    const text = contentMd.slice(cursor, start);
    const isSectionBoundary = match[0] === CHAPTER_SECTION_MARKER;
    if (text.trim() || (isSectionBoundary && blocks.at(-1)?.kind !== "video")) {
      blocks.push({ kind: "text", key: `text-${index++}`, content: text.trim() });
    }
    if (!isSectionBoundary) {
      const url = decodeVideoMarker(match[1], videoUrl);
      if (match[1] === undefined) hasLegacyMarker = true;
      blocks.push({ kind: "video", key: `video-${index++}`, url });
    }
    previousWasSectionBoundary = isSectionBoundary;
    cursor = start + match[0].length;
  }

  const remaining = contentMd.slice(cursor);
  if (remaining.trim() || previousWasSectionBoundary) {
    blocks.push({ kind: "text", key: `text-${index++}`, content: remaining.trim() });
  }
  if (videoUrl && !hasLegacyMarker) {
    blocks.unshift({ kind: "video", key: "legacy-video", url: videoUrl });
  }
  if (!blocks.length) blocks.push({ kind: "text", key: "text-0", content: "" });
  return blocks;
}

export function serializeChapterEditorBlocks(blocks: ChapterEditorBlock[]) {
  return blocks
    .map((block) => block.kind === "text" ? block.content : createChapterVideoMarker(block.url))
    .join(`\n\n${CHAPTER_SECTION_MARKER}\n\n`);
}

export function resolveChapterVideo(value: string): ChapterVideoSource | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/)?.[1];
    return id ? { kind: "embed", src: `https://player.vimeo.com/video/${id}` } : null;
  }

  return /\.(?:mp4|webm|ogg|ogv)$/i.test(url.pathname)
    ? { kind: "file", src: url.toString() }
    : null;
}

export function splitChapterVideo(contentMd: string, videoUrl?: string): ChapterContentBlock[] {
  const blocks = parseChapterEditorBlocks(contentMd, videoUrl);
  return blocks.flatMap<ChapterContentBlock>((block) => {
    if (block.kind === "text") {
      return block.content ? [{ kind: "markdown" as const, key: block.key, content: block.content }] : [];
    }
    return resolveChapterVideo(block.url) ? [{ kind: "video" as const, key: block.key, url: block.url }] : [];
  });
}