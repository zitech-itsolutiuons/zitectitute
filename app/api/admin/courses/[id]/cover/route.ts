import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { json } from "@/lib/http";
import { parseCourseCover, saveCourseCover } from "@/lib/courseCover";
import { Course } from "@/lib/models/Course";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const actorId = await getUserId();
  if (!actorId) return json({ error: "Sign in required." }, 401);
  if (!(await isAdmin(actorId))) return json({ error: "Only administrators can update course covers." }, 403);

  const { id } = await params;
  if (!isValidObjectId(id)) return json({ error: "This course could not be identified." }, 400);

  const form = await request.formData();
  const parsedCover = await parseCourseCover(form.get("coverImage"));
  if (!parsedCover.ok) return json({ error: parsedCover.error }, 400);

  await connectDB();
  const course = await Course.exists({ _id: id });
  if (!course) return json({ error: "This course no longer exists." }, 404);

  await saveCourseCover(id, parsedCover.cover);
  await recordAdminAction({
    actorId,
    action: "courses.cover-updated",
    targetType: "course",
    targetId: id,
    details: { contentType: parsedCover.cover.contentType },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  revalidatePath("/");
  revalidatePath(`/courses/${id}`);
  return json({ success: true });
}
