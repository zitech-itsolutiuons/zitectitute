import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { deleteCourse } from "@/lib/courseOps";
import { json } from "@/lib/http";
import { parseCourseCover, saveCourseCover } from "@/lib/courseCover";
import { Course } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { NewCatalogCourse } from "@/lib/validation";

export async function POST(request: Request) {
  const ownerId = await getUserId();
  if (!ownerId) return json({ error: "Sign in required." }, 401);
  if (!(await isAdmin(ownerId))) return json({ error: "Only administrators can create courses." }, 403);

  const form = await request.formData();
  const parsed = NewCatalogCourse.safeParse({
    title: form.get("title"),
    description: form.get("description") ?? "",
    categoryId: form.get("categoryId"),
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid course details." }, 400);

  const parsedCover = await parseCourseCover(form.get("coverImage"));
  if (!parsedCover.ok) return json({ error: parsedCover.error }, 400);

  await connectDB();
  const category = await CourseCategory.findById(parsed.data.categoryId).select("_id").lean();
  if (!category) return json({ error: "That course category no longer exists. Choose another category." }, 400);

  const course = await Course.create({
    ownerId,
    title: parsed.data.title,
    description: parsed.data.description,
    categoryId: category._id,
    status: "comingSoon",
    stage: "comingSoon",
    catalogVisible: true,
  });
  const courseId = String(course._id);
  try {
    await saveCourseCover(courseId, parsedCover.cover);
    await recordAdminAction({
      actorId: ownerId,
      action: "courses.coming-soon-created",
      targetType: "course",
      targetId: courseId,
    });
  } catch (error) {
    await deleteCourse(courseId);
    throw error;
  }

  return json({ courseId }, 201);
}
