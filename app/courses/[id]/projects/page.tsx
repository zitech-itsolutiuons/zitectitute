import { notFound, redirect } from "next/navigation";
import CourseProjects from "@/components/projects/CourseProjects";
import ManageTabs from "@/components/ManageTabs";
import { getUserId } from "@/lib/auth";
import { getCourseProjectContext } from "@/lib/projectAccess";

export const dynamic = "force-dynamic";

export default async function CourseProjectsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  const { id } = await params;
  const context = await getCourseProjectContext(id, userId);
  if (!context) notFound();
  const canEdit = context.role !== "student";
  return (
    <>
      <ManageTabs
        courseId={id}
        title={context.course.title}
        active="projects"
        admin={context.role === "admin"}
        instructor={context.role === "instructor"}
      />
      <main className="mx-auto max-w-6xl px-5 py-9 md:px-10 md:py-12">
        <CourseProjects courseId={id} courseTitle={context.course.title} canEdit={canEdit} />
      </main>
    </>
  );
}
