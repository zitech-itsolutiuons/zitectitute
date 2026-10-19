import LearnerWorkspaceLayout from "@/components/LearnerWorkspaceLayout";

export const dynamic = "force-dynamic";

export default function CourseOverviewLayout({ children }: { children: React.ReactNode }) {
  return <LearnerWorkspaceLayout>{children}</LearnerWorkspaceLayout>;
}
