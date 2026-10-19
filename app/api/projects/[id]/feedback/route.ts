import { authorizeCourseEditor } from "@/lib/access";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { CourseProject, Notification, ProjectSubmission } from "@/lib/models/LearningFeatures";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
const Input = z.object({
  submissionId: z.string().regex(/^[a-f\d]{24}$/i),
  rubricScores: z.array(z.object({
    criterionIndex: z.number().int().min(0),
    score: z.number().int().min(0),
  })).max(12),
  feedback: z.string().trim().min(3).max(10_000),
});

export async function POST(request: Request, { params }: Context) {
  const projectId = (await params).id;
  if (!isValidObjectId(projectId)) return json({ error: "Project not found" }, 404);
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Complete the rubric and add instructor feedback." }, 400);
  await connectDB();
  const project = await CourseProject.findById(projectId).lean();
  if (!project) return json({ error: "Project not found" }, 404);
  const authorization = await authorizeCourseEditor(String(project.courseId));
  if (authorization instanceof Response) return authorization;
  if (
    parsed.data.rubricScores.length !== project.rubric.length ||
    parsed.data.rubricScores.some((entry, index) => entry.criterionIndex !== index || entry.score > project.rubric[index].points)
  ) {
    return json({ error: "Enter one valid score for each rubric criterion." }, 400);
  }
  const submission = await ProjectSubmission.findOneAndUpdate(
    { _id: parsed.data.submissionId, projectId, courseId: project.courseId },
    {
      $set: {
        rubricScores: parsed.data.rubricScores,
        instructorFeedback: parsed.data.feedback,
        gradedBy: authorization.userId,
        gradedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!submission) return json({ error: "Project submission not found" }, 404);
  await Notification.updateOne(
    { userId: submission.userId, eventKey: `instructor-feedback:${submission._id}` },
    {
      $set: {
        type: "project",
        title: "Instructor feedback is ready",
        message: `Your instructor reviewed your work for ${project.title}.`,
        href: `/courses/${project.courseId}/projects#project-${project._id}`,
      },
      $setOnInsert: { userId: submission.userId, eventKey: `instructor-feedback:${submission._id}` },
    },
    { upsert: true }
  );
  return json({ ok: true });
}
