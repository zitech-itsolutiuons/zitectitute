import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";

export const dynamic = "force-dynamic";

// Every progress write refreshes updatedAt. No write for this long means the
// process running the build died (restart, deploy, timeout).
const STALE_MS = 10 * 60 * 1000;
const INTERRUPTED = "The build was interrupted. Upload the document again.";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerId = await getUserId();
  if (!ownerId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  await connectDB();
  const c = await Course.findById(id).lean();
  if (!c || c.archivedAt || (c.ownerId !== ownerId && !(await isAdmin(ownerId))))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let { status, stage, error } = c;
  const updatedAt = (c as { updatedAt?: Date }).updatedAt;
  if (status === "processing" && updatedAt && Date.now() - updatedAt.getTime() > STALE_MS) {
    await Course.updateOne({ _id: id, status: "processing" }, { $set: { status: "failed", stage: "failed", error: INTERRUPTED } });
    status = "failed";
    stage = "failed";
    error = INTERRUPTED;
  }

  return NextResponse.json({
    status,
    stage,
    title: c.title,
    totalChapters: c.totalChapters,
    lecturesDone: c.lecturesDone,
    quizzesDone: c.quizzesDone,
    error,
  });
}
