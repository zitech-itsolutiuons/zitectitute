import { isValidObjectId } from "mongoose";
import { getUserId } from "@/lib/auth";
import { getCourseAccess } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json, parseBody } from "@/lib/http";
import { Chapter, StudentNote } from "@/lib/models/Course";
import { z } from "zod";

const Body = z.object({
  content: z.string().max(20_000, "Notes are limited to 20,000 characters"),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const { id: chapterId } = await params;
  if (!isValidObjectId(chapterId)) return json({ error: "Module not found" }, 404);
  const body = await parseBody(req, Body);
  if ("res" in body) return body.res;

  await connectDB();
  const chapter = await Chapter.findById(chapterId).select("courseId").lean();
  if (!chapter) return json({ error: "Module not found" }, 404);
  const courseId = String(chapter.courseId);
  if (!(await getCourseAccess(courseId, userId))) return json({ error: "Course not found" }, 404);

  await StudentNote.findOneAndUpdate(
    { userId, courseId, chapterId },
    { $set: { content: body.data.content }, $setOnInsert: { userId, courseId, chapterId } },
    { upsert: true, runValidators: true }
  );
  return json({ ok: true });
}
