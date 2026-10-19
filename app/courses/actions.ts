"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/auth";
import { joinByCode } from "@/lib/courseOps";

export async function joinCourseByCode(formData: FormData) {
  const user = await getUserId();
  if (!user) redirect("/signin");

  const code = String(formData.get("code") ?? "").trim();
  if (!code || code.length > 100) redirect("/courses?join=invalid");

  const sessionUser = await import("@/auth").then(({ auth }) => auth());
  if (!sessionUser?.user) redirect("/signin");
  const course = await joinByCode(code, {
    id: user,
    name: sessionUser.user.name,
    email: sessionUser.user.email,
  });
  if (!course) redirect("/courses?join=invalid");

  revalidatePath("/courses");
  redirect("/courses?join=success");
}