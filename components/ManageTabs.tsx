import Link from "next/link";

const tabs = [
  { key: "read", label: "Course", href: (id: string) => `/courses/${id}` },
  { key: "edit", label: "Edit", href: (id: string) => `/courses/${id}/edit` },
  { key: "students", label: "Students", href: (id: string) => `/courses/${id}/students` },
  { key: "projects", label: "Projects", href: (id: string) => `/courses/${id}/projects` },
] as const;

/** Instructor navigation shared by the edit and students pages. */
export default function ManageTabs({
  courseId,
  title,
  active,
  admin = false,
  instructor = false,
}: {
  courseId: string;
  title: string;
  active: "read" | "edit" | "students" | "projects";
  admin?: boolean;
  instructor?: boolean;
}) {
  const editorOnly = admin || instructor;
  const visibleTabs = editorOnly ? tabs.filter((tab) => tab.key === "edit" || tab.key === "projects") : tabs;

  return (
    <div className="border-0 border-b border-blue-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-10">
        <p className="min-w-0 truncate text-sm font-medium text-blue-700">{title}</p>
        <nav aria-label={admin ? "Administrator course editing" : instructor ? "Instructor course editing" : "Course sections"} className="flex">
          {editorOnly && (
            <Link href={admin ? "/admin/courses" : "/courses"} className="mr-3 inline-flex min-h-9 items-center text-sm font-medium text-blue-700 hover:text-blue-900">
              {admin ? "Course library" : "My courses"}
            </Link>
          )}
          {visibleTabs.map((t) => (
            <Link
              key={t.key}
              href={t.href(courseId)}
              aria-current={t.key === active ? "page" : undefined}
              className={`border border-blue-200 px-4 py-1.5 text-sm ${t.key !== "read" ? "-ml-px" : ""} ${
                t.key === active ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-blue-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
