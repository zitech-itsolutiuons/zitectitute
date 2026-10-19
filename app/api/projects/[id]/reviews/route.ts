import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { CourseProject, Notification, ProjectPeerReview } from "@/lib/models/LearningFeatures";
import { getCourseProjectContext } from "@/lib/projectAccess";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
const Input = z.object({
  submissionId: z.string().regex(/^[a-f\d]{24}$/i),
  rubricScores: z.array(z.object({ criterionIndex: z.number().int().min(0), score: z.number().int().min(0) })).max(12),
  feedback: z.string().trim().min(3).max(5000),
});

export async function POST(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const projectId = (await params).id;
  if (!isValidObjectId(projectId)) return json({ error: "Project not found" }, 404);
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Complete every rubric score and add feedback." }, 400);
  await connectDB();

  const project = await CourseProject.findById(projectId).lean();
  if (!project) return json({ error: "Project not found" }, 404);
  const access = await getCourseProjectContext(String(project.courseId), userId);
  if (!access || access.role !== "student") return json({ error: "Only enrolled learners can complete peer reviews." }, 403);
  if (!project.peerReviewEnabled) return json({ error: "Peer review is not enabled for this project." }, 409);
  if (
    parsed.data.rubricScores.length !== project.rubric.length ||
    parsed.data.rubricScores.some((entry, index) => entry.criterionIndex !== index || entry.score > project.rubric[index].points)
  ) {
    return json({ error: "Enter one valid score for each rubric criterion." }, 400);
  }
  const review = await ProjectPeerReview.findOne({
    projectId,
    submissionId: parsed.data.submissionId,
    reviewerId: userId,
  });
  if (!review) return json({ error: "Peer review assignment not found" }, 404);
  if (review.authorId === userId) return json({ error: "You cannot review your own work." }, 403);
  if (review.submittedAt) return json({ error: "This peer review has already been submitted." }, 409);

  review.set({
    rubricScores: parsed.data.rubricScores,
    feedback: parsed.data.feedback,
    submittedAt: new Date(),
  });
  await review.save();
  await Notification.updateOne(
    { userId: review.authorId, eventKey: `peer-review-complete:${review._id}` },
    {
      $setOnInsert: {
        userId: review.authorId,
        type: "project",
        title: "Peer feedback is ready",
        message: `A classmate reviewed your work for ${project.title}.`,
        href: `/courses/${project.courseId}/projects#project-${project._id}`,
        eventKey: `peer-review-complete:${review._id}`,
      },
    },
    { upsert: true }
  );
  return json({ ok: true });
}
