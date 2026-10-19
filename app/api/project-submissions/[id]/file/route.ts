import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { CourseProject, ProjectPeerReview, ProjectSubmission, ProjectSubmissionFile } from "@/lib/models/LearningFeatures";
import { getCourseProjectContext } from "@/lib/projectAccess";
import { isValidObjectId } from "mongoose";
import { json } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const submissionId = (await params).id;
  if (!isValidObjectId(submissionId)) return json({ error: "File not found" }, 404);
  await connectDB();
  const submission = await ProjectSubmission.findById(submissionId).lean();
  if (!submission) return json({ error: "File not found" }, 404);
  const access = await getCourseProjectContext(String(submission.courseId), userId);
  if (!access) return json({ error: "File not found" }, 404);
  if (access.role === "student" && submission.userId !== userId) {
    const assigned = await ProjectPeerReview.exists({ submissionId, reviewerId: userId });
    if (!assigned) return json({ error: "File not found" }, 404);
  }
  const [project, file] = await Promise.all([
    CourseProject.findById(submission.projectId).select("courseId").lean(),
    ProjectSubmissionFile.findOne({ submissionId }).lean(),
  ]);
  if (!project || !file) return json({ error: "File not found" }, 404);
  const bytes = file.data.buffer.subarray(0, file.data.position);
  if (bytes.byteLength !== file.size) return json({ error: "Stored submission file is incomplete." }, 500);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const filename = encodeURIComponent(file.filename);
  return new Response(body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename.replace(/["\\]/g, "_")}"; filename*=UTF-8''${filename}`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
