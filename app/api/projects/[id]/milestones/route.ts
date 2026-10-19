import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { CourseProject, ProjectSubmission } from "@/lib/models/LearningFeatures";
import { getCourseProjectContext } from "@/lib/projectAccess";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
const Input = z.object({ completedMilestoneIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(12) });

export async function PATCH(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const projectId = (await params).id;
  if (!isValidObjectId(projectId)) return json({ error: "Project not found" }, 404);
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Choose valid project milestones." }, 400);

  await connectDB();
  const project = await CourseProject.findById(projectId).select("courseId milestones").lean();
  if (!project) return json({ error: "Project not found" }, 404);
  const access = await getCourseProjectContext(String(project.courseId), userId);
  if (!access || access.role !== "student") return json({ error: "Only enrolled learners can update project milestones." }, 403);
  const validIds = new Set(project.milestones.map((milestone) => String(milestone._id)));
  if (parsed.data.completedMilestoneIds.some((id) => !validIds.has(id))) {
    return json({ error: "A selected milestone does not belong to this project." }, 400);
  }
  const submission = await ProjectSubmission.findOneAndUpdate(
    { projectId, userId },
    {
      $set: {
        courseId: project.courseId,
        completedMilestoneIds: [...new Set(parsed.data.completedMilestoneIds)],
      },
      $setOnInsert: { projectId, userId },
    },
    { new: true, upsert: true, runValidators: true }
  ).select("completedMilestoneIds").lean();
  return json({ ok: true, completedMilestoneIds: (submission?.completedMilestoneIds ?? []).map(String) });
}
