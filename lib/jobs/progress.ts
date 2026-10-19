import { connectDB } from "../db";
import { Course } from "../models/Course";

type Patch = {
  stage?: "queued" | "parsing" | "outline" | "writing" | "saving" | "ready" | "failed";
  status?: "processing" | "ready" | "failed";
  title?: string;
  totalChapters?: number;
  error?: string;
};

/**
 * Progress lives on the Course document, so the status endpoint and the progress
 * screen need no extra infrastructure. Every write also bumps `updatedAt`, which
 * doubles as a heartbeat for detecting builds that died (see the status route).
 * Progress writes must never fail the build, so errors are swallowed.
 */
export async function setProgress(courseId: string, patch: Patch) {
  try {
    await connectDB();
    await Course.updateOne({ _id: courseId }, { $set: patch });
  } catch (err) {
    console.warn("[progress] setProgress failed", err);
  }
}

/** Atomic counter: safe with parallel chapter steps. */
export async function bump(courseId: string, field: "lecturesDone" | "quizzesDone") {
  try {
    await connectDB();
    await Course.updateOne({ _id: courseId }, { $inc: { [field]: 1 } });
  } catch (err) {
    console.warn("[progress] bump failed", err);
  }
}
