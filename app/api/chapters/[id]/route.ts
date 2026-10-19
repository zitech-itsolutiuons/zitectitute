import { authorizeChapterEditor } from "@/lib/access";
import { deleteChapter } from "@/lib/courseOps";
import { json, parseBody } from "@/lib/http";
import { Chapter } from "@/lib/models/Course";
import { ChapterPatch } from "@/lib/validation";
import { recordAdminAction } from "@/lib/adminAudit";
import { restoreCourseMediaUrls } from "@/lib/videoProtection";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a chapter's title and/or lecture Markdown. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await authorizeChapterEditor((await params).id);
  if (auth instanceof Response) return auth;
  const body = await parseBody(req, ChapterPatch);
  if ("res" in body) return body.res;
  const updates = body.data.contentMd === undefined
    ? body.data
    : { ...body.data, contentMd: restoreCourseMediaUrls(body.data.contentMd, String(auth.chapter.courseId)) };
  await Chapter.updateOne({ _id: auth.chapter._id }, { $set: updates });
  if (auth.isAdmin) {
    await recordAdminAction({ actorId: auth.userId, action: "courses.chapter-edited", targetType: "chapter", targetId: String(auth.chapter._id) });
  }
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await authorizeChapterEditor((await params).id);
  if (auth instanceof Response) return auth;
  const ok = await deleteChapter(String(auth.chapter.courseId), String(auth.chapter._id));
  if (ok && auth.isAdmin) {
    await recordAdminAction({ actorId: auth.userId, action: "courses.chapter-deleted", targetType: "chapter", targetId: String(auth.chapter._id) });
  }
  return ok ? json({ ok: true }) : json({ error: "A course needs at least one module" }, 400);
}
