import { randomInt } from "node:crypto";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { CourseProject, Notification, ProjectPeerReview, ProjectSubmission, ProjectSubmissionFile } from "@/lib/models/LearningFeatures";
import { CourseRestriction, StudentProgress } from "@/lib/models/Course";
import { User } from "@/lib/models/User";
import { CourseAccessGrant } from "@/lib/models/CourseCommerce";
import { getCourseProjectContext } from "@/lib/projectAccess";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedContentTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function POST(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const projectId = (await params).id;
  if (!isValidObjectId(projectId)) return json({ error: "Project not found" }, 404);
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 6 * 1024 * 1024) {
    return json({ error: "The submission is too large. Keep the uploaded file under 5 MB." }, 413);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Choose a valid submission form." }, 400);
  }
  const writtenResponse = String(form.get("writtenResponse") ?? "").trim();
  const projectLink = String(form.get("projectLink") ?? "").trim();
  const fileEntry = form.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  const textResult = z.string().max(20_000).safeParse(writtenResponse);
  const linkResult = z.string().max(2048).safeParse(projectLink);
  if (!textResult.success || !linkResult.success) return json({ error: "Your response or project link is too long." }, 400);
  if (projectLink) {
    const parsedLink = z.string().url().safeParse(projectLink);
    if (!parsedLink.success || !["http:", "https:"].includes(new URL(projectLink).protocol)) {
      return json({ error: "Enter a complete http or https project link." }, 400);
    }
  }
  if (file && (file.size > MAX_FILE_SIZE || !allowedContentTypes.has(file.type))) {
    return json({ error: "Upload a PDF, DOCX, TXT, JPG, PNG, or WEBP file up to 5 MB." }, 400);
  }

  await connectDB();
  const project = await CourseProject.findById(projectId).lean();
  if (!project) return json({ error: "Project not found" }, 404);
  const access = await getCourseProjectContext(String(project.courseId), userId);
  if (!access || access.role !== "student") return json({ error: "Only enrolled learners can submit project work." }, 403);
  if (project.closedAt) return json({ error: "This project is closed to new submissions." }, 409);
  if (!writtenResponse && !projectLink && !file) {
    const existingSubmission = await ProjectSubmission.findOne({ projectId, userId }).select("_id").lean();
    const existingFile = existingSubmission
      ? await ProjectSubmissionFile.exists({ submissionId: existingSubmission._id })
      : null;
    if (!existingFile) return json({ error: "Add a written response, project link, or file." }, 400);
  }

  const submission = await ProjectSubmission.findOneAndUpdate(
    { projectId, userId },
    {
      $set: {
        courseId: project.courseId,
        writtenResponse,
        projectLink,
        submittedAt: new Date(),
      },
      $setOnInsert: { projectId, userId, completedMilestoneIds: [] },
    },
    { new: true, upsert: true, runValidators: true }
  );
  if (file) {
    const safeName = file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(-160) || "submission";
    await ProjectSubmissionFile.findOneAndUpdate(
      { submissionId: submission._id },
      {
        $set: {
          filename: safeName,
          contentType: "application/octet-stream",
          size: file.size,
          data: Buffer.from(await file.arrayBuffer()),
        },
        $setOnInsert: { submissionId: submission._id },
      },
      { upsert: true, runValidators: true }
    );
  }

  let assignedReviewCount = await ProjectPeerReview.countDocuments({ submissionId: submission._id });
  if (project.peerReviewEnabled && assignedReviewCount === 0) {
    const [enrolled, grants] = await Promise.all([
      StudentProgress.find({ courseId: project.courseId, userId: { $ne: userId } }).select("userId").lean(),
      CourseAccessGrant.find({ courseId: project.courseId, userId: { $ne: userId } }).select("userId").lean(),
    ]);
    const candidates = await User.find({
      _id: { $in: [...new Set([...enrolled, ...grants].map((entry) => entry.userId))] },
      role: "user",
    }).select("_id").lean();
    const restricted = await CourseRestriction.find({
      courseId: project.courseId,
      userId: { $in: candidates.map((candidate) => String(candidate._id)) },
    }).select("userId").lean();
    const restrictedIds = new Set(restricted.map((entry) => entry.userId));
    const reviewers = shuffled(candidates.filter((candidate) => !restrictedIds.has(String(candidate._id)))).slice(0, project.peerReviewerCount);
    for (const reviewer of reviewers) {
      const peerReview = await ProjectPeerReview.findOneAndUpdate(
        { submissionId: submission._id, reviewerId: String(reviewer._id) },
        {
          $setOnInsert: {
            projectId,
            submissionId: submission._id,
            authorId: userId,
            reviewerId: String(reviewer._id),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      await Notification.updateOne(
        { userId: String(reviewer._id), eventKey: `peer-review:${peerReview._id}` },
        {
          $setOnInsert: {
            userId: String(reviewer._id),
            type: "peer-review",
            title: "A peer review is ready",
            message: `Review a learner submission for ${project.title}.`,
            href: `/courses/${project.courseId}/projects#review-${peerReview._id}`,
            eventKey: `peer-review:${peerReview._id}`,
          },
        },
        { upsert: true }
      );
    }
    assignedReviewCount = reviewers.length;
  }

  const recipients = [...new Set([access.course.ownerId, access.course.instructorId].filter((id): id is string => Boolean(id) && id !== userId))];
  for (const recipientId of recipients) {
    await Notification.updateOne(
      { userId: recipientId, eventKey: `project-submission:${submission._id}` },
      {
        $setOnInsert: {
          userId: recipientId,
          type: "project",
          title: "New project submission",
          message: `A learner submitted work for ${project.title}.`,
          href: `/courses/${project.courseId}/projects#project-${project._id}`,
          eventKey: `project-submission:${submission._id}`,
        },
      },
      { upsert: true }
    );
  }
  return json({ ok: true, assignedReviewCount, peerReviewEnabled: project.peerReviewEnabled });
}
