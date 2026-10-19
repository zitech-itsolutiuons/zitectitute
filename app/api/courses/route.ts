import { NextResponse } from "next/server";
import { after } from "next/server";
import { isValidObjectId } from "mongoose";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { buildCourse } from "@/lib/jobs/buildCourse";
import { parseCourseCover, saveCourseCover, type CourseCoverPayload } from "@/lib/courseCover";

export const runtime = "nodejs"; // pdf-parse and mammoth need Node APIs
export const maxDuration = 300; // on serverless hosts this also caps how long after() may keep running

const MAX_BYTES = 15 * 1024 * 1024;

// Browsers often send an empty type for .md/.docx, so fall back to the extension.
const BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};
const mimeFor = (f: File) => BY_EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] ?? f.type;

/**
 * Validates, creates the course record and returns 202 immediately.
 * The heavy work (parse, three-step pipeline, save) runs via after(), and the
 * course page polls GET /api/courses/[id]/status to show live progress.
 */
export async function POST(req: Request) {
  const ownerId = await getUserId();
  if (!ownerId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!(await isAdmin(ownerId))) return NextResponse.json({ error: "Only admins can upload courses" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const targetCourseId = form.get("courseId");
  const categoryId = form.get("categoryId");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (targetCourseId !== null && (typeof targetCourseId !== "string" || !isValidObjectId(targetCourseId)))
    return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  if (targetCourseId === null && (typeof categoryId !== "string" || !isValidObjectId(categoryId)))
    return NextResponse.json({ error: "Choose a course category before creating a course." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (15 MB max)" }, { status: 413 });
  const mimeType = mimeFor(file);
  if (!Object.values(BY_EXT).includes(mimeType))
    return NextResponse.json({ error: "Unsupported file type. Use PDF, DOCX, TXT or Markdown." }, { status: 415 });

  let cover: CourseCoverPayload | null = null;
  if (targetCourseId === null) {
    const parsedCover = await parseCourseCover(form.get("coverImage"));
    if (!parsedCover.ok) return NextResponse.json({ error: parsedCover.error }, { status: 400 });
    cover = parsedCover.cover;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await connectDB();
  let courseId: string;
  if (typeof targetCourseId === "string") {
    const course = await Course.findOne({
      _id: targetCourseId,
      catalogVisible: true,
      archivedAt: null,
      status: { $in: ["comingSoon", "failed"] },
    }).select("_id").lean();
    if (!course) return NextResponse.json({ error: "This course is not ready for materials" }, { status: 409 });
    courseId = String(course._id);
    await Course.updateOne(
      { _id: courseId },
      {
        $set: { status: "processing", stage: "queued", sourceFileName: file.name, totalChapters: 0, lecturesDone: 0, quizzesDone: 0 },
        $unset: { error: 1 },
      }
    );
  } else {
    const category = await CourseCategory.findById(categoryId).select("_id").lean();
    if (!category) return NextResponse.json({ error: "That course category no longer exists. Choose another category." }, { status: 400 });
    const course = await Course.create({
      ownerId,
      title: file.name,
      categoryId: category._id,
      sourceFileName: file.name,
      stage: "queued",
      catalogVisible: true,
    });
    courseId = course.id;
    if (!cover) throw new Error("Course cover validation completed without image data.");
    await saveCourseCover(courseId, cover);
  }

  after(() => buildCourse(courseId, buffer, mimeType, typeof targetCourseId === "string"));
  return NextResponse.json({ courseId }, { status: 202 });
}
