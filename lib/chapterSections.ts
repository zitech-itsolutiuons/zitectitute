export type ChapterSection = {
  id: string;
  title: string;
  contentMd: string;
};

type ChapterSectionRange = ChapterSection & {
  start: number;
  bodyStart: number;
  end: number;
  headingPrefix: string | null;
  lineEnding: string;
};

function sectionId(index: number, title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `section-${index + 1}-${slug || "content"}`;
}

function chapterSectionRanges(contentMd: string): ChapterSectionRange[] {
  const lines: { value: string; start: number; end: number }[] = [];
  let offset = 0;
  for (const value of contentMd.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    lines.push({ value, start: offset, end: offset + value.length });
    offset += value.length;
  }

  const headings: { title: string; start: number; bodyStart: number; prefix: string; lineEnding: string }[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const text = line.value.replace(/\r?\n$/, "");
    const fenceMatch = text.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
    }

    const heading = !fence ? text.match(/^(#{2,3}\s+)(.+?)\s*#*\s*$/) : null;
    if (heading) headings.push({
      title: heading[2].trim(),
      start: line.start,
      bodyStart: line.end,
      prefix: heading[1],
      lineEnding: line.value.slice(text.length),
    });
  }

  const ranges: Omit<ChapterSectionRange, "id">[] = [];
  if (headings.length) {
    const preamble = contentMd.slice(0, headings[0].start).trim();
    if (preamble) ranges.push({
      title: "Introduction",
      contentMd: preamble,
      start: 0,
      bodyStart: 0,
      end: headings[0].start,
      headingPrefix: null,
      lineEnding: "",
    });
    headings.forEach((heading, index) => {
      const end = headings[index + 1]?.start ?? contentMd.length;
      ranges.push({
        title: heading.title,
        contentMd: contentMd.slice(heading.bodyStart, end).trim(),
        start: heading.start,
        bodyStart: heading.bodyStart,
        end,
        headingPrefix: heading.prefix,
        lineEnding: heading.lineEnding,
      });
    });
  } else {
    ranges.push({
      title: "Module content",
      contentMd: contentMd.trim(),
      start: 0,
      bodyStart: 0,
      end: contentMd.length,
      headingPrefix: null,
      lineEnding: "",
    });
  }

  return ranges.map((section, index) => ({
    ...section,
    id: sectionId(index, section.title),
  }));
}

export function parseChapterSections(contentMd: string): ChapterSection[] {
  return chapterSectionRanges(contentMd).map(({ id, title, contentMd: sectionContent }) => ({
    id,
    title,
    contentMd: sectionContent,
  }));
}

export function replaceChapterSection(
  contentMd: string,
  sectionIndex: number,
  title: string,
  body: string,
  preserveExistingVideoMarkers = true
) {
  const section = chapterSectionRanges(contentMd)[sectionIndex];
  if (!section) return contentMd;

  const videoMarkers = [
    ...(preserveExistingVideoMarkers ? [...section.contentMd.matchAll(/\{\{chapter-video(?::[^{}\r\n]*)?\}\}/g)] : []),
    ...body.matchAll(/\{\{chapter-video(?::[^{}\r\n]*)?\}\}/g),
  ].map((match) => match[0]);
  const cleanBody = body
    .replace(/\{\{chapter-video(?::[^{}\r\n]*)?\}\}|\{\{chapter-section\}\}/g, "")
    .trim();
  const nextBody = [cleanBody, ...new Set(videoMarkers)].filter(Boolean).join("\n\n");
  const nextTitle = title.trim() || "Untitled lesson";
  const replacement = section.headingPrefix
    ? `${section.headingPrefix}${nextTitle}${section.lineEnding}${nextBody}`
    : nextTitle === section.title
      ? nextBody
      : `## ${nextTitle}\n\n${nextBody}`;

  const suffix = contentMd.slice(section.end);
  return `${contentMd.slice(0, section.start)}${replacement}${suffix ? `\n\n${suffix}` : ""}`;
}
