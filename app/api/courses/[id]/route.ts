import { authorizeCourseEditor, authorizeOwner } from "@/lib/access";
import { deleteCourse } from "@/lib/courseOps";
import { isAdmin } from "@/lib/auth";
import { json, parseBody } from "@/lib/http";
import { Course } from "@/lib/models/Course";
import { CoursePatch } from "@/lib/validation";
import { recordAdminAction } from "@/lib/adminAudit";

type Ctx = { params: Promise<{ id: string }> };

/** Edit course title / description (course owner or administrator). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeCourseEditor(id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, CoursePatch);
  if ("res" in body) return body.res;
  if (body.data.codePracticeEnabled !== undefined && !(await isAdmin(auth.userId))) {
    return json({ error: "Only an administrator can change the code practice setting" }, 403);
  }
  await Course.updateOne({ _id: id }, { $set: body.data });
  if (auth.isAdmin) {
    await recordAdminAction({
      actorId: auth.userId,
      action: "courses.details-edited",
      targetType: "course",
      targetId: id,
      details: { fields: Object.keys(body.data).join(",") },
    });
  }
  return json({ ok: true });
}

/** Deletes the course with its chapters, quizzes and every student's progress. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  await deleteCourse(id);
  return json({ ok: true });
}
