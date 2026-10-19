"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserId, isAdmin } from "@/lib/auth";
import { recordAdminAction } from "@/lib/adminAudit";
import { connectDB } from "@/lib/db";
import { Course } from "@/lib/models/Course";
import { CourseCategory } from "@/lib/models/CourseCategory";
import { CourseCategoryName, objectId } from "@/lib/validation";

async function requireAdmin() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  if (!(await isAdmin(userId))) redirect("/courses");
  return userId;
}

function slugForCategory(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `category-${Array.from(name).map((character) => character.codePointAt(0)!.toString(16)).join("-")}`;
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function refreshCategorySurfaces() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/courses");
}

export async function createCourseCategoryAction(formData: FormData) {
  const actorId = await requireAdmin();
  const parsedName = CourseCategoryName.safeParse(formData.get("name"));
  if (!parsedName.success) redirect("/admin/categories?notice=invalid");

  const slug = slugForCategory(parsedName.data);
  await connectDB();
  if (await CourseCategory.exists({ slug })) redirect("/admin/categories?notice=duplicate");

  try {
    const category = await CourseCategory.create({ name: parsedName.data, slug });
    await recordAdminAction({ actorId, action: "categories.created", targetType: "category", targetId: String(category._id) });
  } catch (error) {
    if (isDuplicateKeyError(error)) redirect("/admin/categories?notice=duplicate");
    throw error;
  }

  refreshCategorySurfaces();
  redirect("/admin/categories?notice=created");
}

export async function renameCourseCategoryAction(formData: FormData) {
  const actorId = await requireAdmin();
  const categoryId = objectId.safeParse(formData.get("categoryId"));
  const parsedName = CourseCategoryName.safeParse(formData.get("name"));
  if (!categoryId.success) redirect("/admin/categories?notice=invalid");
  if (!parsedName.success) redirect("/admin/categories?notice=invalid");

  const slug = slugForCategory(parsedName.data);
  await connectDB();
  const duplicate = await CourseCategory.exists({ slug, _id: { $ne: categoryId.data } });
  if (duplicate) redirect("/admin/categories?notice=duplicate");

  try {
    const result = await CourseCategory.updateOne(
      { _id: categoryId.data },
      { $set: { name: parsedName.data, slug } },
      { runValidators: true }
    );
    if (!result.matchedCount) redirect("/admin/categories?notice=missing");
  } catch (error) {
    if (isDuplicateKeyError(error)) redirect("/admin/categories?notice=duplicate");
    throw error;
  }

  await recordAdminAction({ actorId, action: "categories.renamed", targetType: "category", targetId: categoryId.data });
  refreshCategorySurfaces();
  redirect("/admin/categories?notice=renamed");
}

export async function deleteCourseCategoryAction(formData: FormData) {
  const actorId = await requireAdmin();
  const categoryId = objectId.safeParse(formData.get("categoryId"));
  if (!categoryId.success) redirect("/admin/categories?notice=invalid");

  await connectDB();
  if (await Course.exists({ categoryId: categoryId.data })) {
    redirect("/admin/categories?notice=in-use");
  }
  const result = await CourseCategory.deleteOne({ _id: categoryId.data });
  if (!result.deletedCount) redirect("/admin/categories?notice=missing");

  await recordAdminAction({ actorId, action: "categories.deleted", targetType: "category", targetId: categoryId.data });
  refreshCategorySurfaces();
  redirect("/admin/categories?notice=deleted");
}

export async function assignCourseCategoryAction(formData: FormData) {
  const actorId = await requireAdmin();
  const courseId = formData.get("courseId");
  const categoryId = formData.get("categoryId");
  if (typeof courseId !== "string" || !isValidObjectId(courseId) || typeof categoryId !== "string" || !isValidObjectId(categoryId)) {
    redirect("/admin/courses?category=invalid");
  }

  await connectDB();
  if (!(await CourseCategory.exists({ _id: categoryId }))) redirect("/admin/courses?category=invalid");
  const result = await Course.updateOne({ _id: courseId }, { $set: { categoryId } });
  if (!result.matchedCount) redirect("/admin/courses?category=missing");

  await recordAdminAction({ actorId, action: "courses.category-assigned", targetType: "course", targetId: courseId, details: { categoryId } });
  refreshCategorySurfaces();
  redirect("/admin/courses?category=saved");
}
