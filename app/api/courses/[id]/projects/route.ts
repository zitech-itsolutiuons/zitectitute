import { authorizeCourseEditor } from "@/lib/access";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { CourseProject, ProjectPeerReview, ProjectSubmission, ProjectSubmissionFile } from "@/lib/models/LearningFeatures";
import { User } from "@/lib/models/User";
import { getCourseProjectContext } from "@/lib/projectAccess";
import { isValidObjectId } from "mongoose";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };

const MilestoneInput = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
});
const RubricInput = z.object({
  criterion: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).default(""),
  points: z.number().int().min(1).max(100),
});
const ProjectInput = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(5000),
  instructions: z.string().trim().max(20_000).default(""),
  milestones: z.array(MilestoneInput).max(12),
  rubric: z.array(RubricInput).min(1).max(12),
  peerReviewEnabled: z.boolean(),
  peerReviewerCount: z.number().int().min(0).max(5),
  dueAt: z.string().datetime().nullable(),
}).superRefine((value, context) => {
  if (value.peerReviewEnabled && value.peerReviewerCount < 1) {
    context.addIssue({ code: "custom", path: ["peerReviewerCount"], message: "Choose at least one peer reviewer." });
  }
  if (!value.peerReviewEnabled && value.peerReviewerCount !== 0) {
    context.addIssue({ code: "custom", path: ["peerReviewerCount"], message: "Reviewer count must be zero when peer review is off." });
  }
});

export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return json({ error: "Sign in required" }, 401);
  const courseId = (await params).id;
  const context = await getCourseProjectContext(courseId, userId);
  if (!context) return json({ error: "Course not found" }, 404);
  await connectDB();

  const projects = await CourseProject.find({ courseId }).sort({ createdAt: -1 }).lean();
  const projectIds = projects.map((project) => project._id);
  if (context.role === "owner" || context.role === "instructor" || context.role === "admin") {
    const submissions = projectIds.length
      ? await ProjectSubmission.find({ projectId: { $in: projectIds } }).sort({ submittedAt: -1 }).limit(200).lean()
      : [];
    const authorIds = [...new Set(submissions.map((submission) => submission.userId))];
    const authors = authorIds.length ? await User.find({ _id: { $in: authorIds } }).select("name email").lean() : [];
    const files = submissions.length
      ? await ProjectSubmissionFile.find({ submissionId: { $in: submissions.map((submission) => submission._id) } }).select("submissionId filename size").lean()
      : [];
    const authorById = new Map(authors.map((author) => [String(author._id), { name: author.name, email: author.email }]));
    const fileBySubmission = new Map(files.map((file) => [String(file.submissionId), { filename: file.filename, size: file.size }]));
    return json({
      projects,
      submissions: submissions.map((submission) => ({
        ...submission,
        learner: authorById.get(submission.userId) ?? { name: "Learner", email: "" },
        file: fileBySubmission.get(String(submission._id)) ?? null,
      })),
      reviews: [],
      receivedReviews: [],
      reviewSubmissions: [],
    });
  }

  const [submissions, reviews, receivedReviews] = await Promise.all([
    projectIds.length ? ProjectSubmission.find({ userId, projectId: { $in: projectIds } }).lean() : Promise.resolve([]),
    projectIds.length ? ProjectPeerReview.find({ reviewerId: userId, projectId: { $in: projectIds } }).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
    projectIds.length ? ProjectPeerReview.find({ authorId: userId, projectId: { $in: projectIds }, submittedAt: { $ne: null } }).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
  ]);
  const ownFiles = projectIds.length
    ? await ProjectSubmissionFile.find({ submissionId: { $in: submissions.map((submission) => submission._id) } }).select("submissionId filename size").lean()
    : [];
  const reviewSubmissionIds = reviews.map((review) => review.submissionId);
  const reviewSubmissions = reviewSubmissionIds.length
    ? await ProjectSubmission.find({ _id: { $in: reviewSubmissionIds } }).lean()
    : [];
  const reviewFiles = reviewSubmissionIds.length
    ? await ProjectSubmissionFile.find({ submissionId: { $in: reviewSubmissionIds } }).select("submissionId filename size").lean()
    : [];
  const fileBySubmission = new Map(reviewFiles.map((file) => [String(file.submissionId), { filename: file.filename, size: file.size }]));
  const ownFileBySubmission = new Map(ownFiles.map((file) => [String(file.submissionId), { filename: file.filename, size: file.size }]));
  const submissionById = new Map(reviewSubmissions.map((submission) => [String(submission._id), {
    _id: String(submission._id),
    writtenResponse: submission.writtenResponse,
    projectLink: submission.projectLink,
  }]));
  return json({
    projects,
    submissions: submissions.map((submission) => ({
      ...submission,
      file: ownFileBySubmission.get(String(submission._id)) ?? null,
    })),
    receivedReviews: receivedReviews.map((review) => ({
      _id: String(review._id),
      projectId: String(review.projectId),
      rubricScores: review.rubricScores,
      feedback: review.feedback,
      submittedAt: review.submittedAt,
    })),
    reviewSubmissions: reviews.map((review) => ({
      reviewId: String(review._id),
      projectId: String(review.projectId),
      submission: submissionById.get(String(review.submissionId))
        ? { ...submissionById.get(String(review.submissionId)), file: fileBySubmission.get(String(review.submissionId)) ?? null }
        : null,
    })),
    reviews: reviews.map((review) => ({
      _id: String(review._id),
      projectId: String(review.projectId),
      submissionId: String(review.submissionId),
      rubricScores: review.rubricScores,
      feedback: review.feedback,
      submittedAt: review.submittedAt,
    })),
  });
}

export async function POST(request: Request, { params }: Context) {
  const courseId = (await params).id;
  const authorization = await authorizeCourseEditor(courseId);
  if (authorization instanceof Response) return authorization;
  const parsed = ProjectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Check the project details, milestones, rubric, and peer-review settings." }, 400);
  const { projectId, dueAt, ...input } = parsed.data;
  if (projectId && !isValidObjectId(projectId)) return json({ error: "Project not found" }, 404);

  await connectDB();
  if (projectId) {
    const currentProject = await CourseProject.findOne({ _id: projectId, courseId }).select("milestones").lean();
    if (!currentProject) return json({ error: "Project not found" }, 404);
    const existingMilestoneIds = new Set(currentProject.milestones.map((milestone) => String(milestone._id)));
    if (input.milestones.some((milestone) => milestone._id && !existingMilestoneIds.has(milestone._id))) {
      return json({ error: "A milestone does not belong to this project." }, 400);
    }
    const project = await CourseProject.findOneAndUpdate(
      { _id: projectId, courseId },
      {
        $set: {
          ...input,
          peerReviewerCount: input.peerReviewEnabled ? input.peerReviewerCount : 0,
          dueAt: dueAt ? new Date(dueAt) : null,
          updatedBy: authorization.userId,
        },
      },
      { new: true, runValidators: true }
    ).lean();
    if (!project) return json({ error: "Project not found" }, 404);
    return json({ ok: true, project });
  }

  const project = await CourseProject.create({
    ...input,
    milestones: input.milestones.map(({ _id: _unused, ...milestone }) => milestone),
    courseId,
    dueAt: dueAt ? new Date(dueAt) : null,
    createdBy: authorization.userId,
    updatedBy: authorization.userId,
  });
  return json({ ok: true, project: project.toObject() }, 201);
}

export async function PATCH(request: Request, { params }: Context) {
  const courseId = (await params).id;
  const authorization = await authorizeCourseEditor(courseId);
  if (authorization instanceof Response) return authorization;
  const body = z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i), closed: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "Choose a project and valid status." }, 400);
  await connectDB();
  const project = await CourseProject.findOneAndUpdate(
    { _id: body.data.projectId, courseId },
    { $set: { closedAt: body.data.closed ? new Date() : null, updatedBy: authorization.userId } },
    { new: true }
  ).lean();
  if (!project) return json({ error: "Project not found" }, 404);
  return json({ ok: true, project });
}
