import { CourseMedia } from "@/lib/models/Course";

export const MAX_COURSE_COVER_BYTES = 5 * 1024 * 1024;
const COURSE_COVER_INDEX = -1;

export type CourseCoverPayload = { contentType: string; data: Buffer };
type CourseCoverResult = { ok: true; cover: CourseCoverPayload } | { ok: false; error: string };

function imageContentType(data: Buffer) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export async function parseCourseCover(value: FormDataEntryValue | null): Promise<CourseCoverResult> {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, error: "Choose a course cover image." };
  }
  if (value.size > MAX_COURSE_COVER_BYTES) {
    return { ok: false, error: "The cover image must be 5 MB or smaller." };
  }

  const data = Buffer.from(await value.arrayBuffer());
  const contentType = imageContentType(data);
  if (!contentType) {
    return { ok: false, error: "Choose a valid JPG, PNG, or WebP image." };
  }
  return { ok: true, cover: { contentType, data } };
}

export async function saveCourseCover(courseId: string, cover: CourseCoverPayload) {
  await CourseMedia.updateOne(
    { courseId, index: COURSE_COVER_INDEX },
    { $set: { contentType: cover.contentType, data: cover.data } },
    { upsert: true },
  );
}
