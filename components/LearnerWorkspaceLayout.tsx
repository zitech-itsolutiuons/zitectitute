import type { ReactNode } from "react";
import { auth } from "@/auth";
import StudentDashboardSidebar from "@/components/StudentDashboardSidebar";
import SiteHeader from "@/components/SiteHeader";
import { connectDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { Cohort } from "@/lib/models/Cohort";
import { SupportConversation } from "@/lib/models/SupportConversation";
import { UserProfile } from "@/lib/models/UserProfile";

export default async function LearnerWorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;
  let sidebar: ReactNode = null;

  if (userId && !session?.user.platformRestricted) {
    await connectDB();
    const [profile, canUpload, hasCohorts] = await Promise.all([
      UserProfile.findOne({ userId }).select("displayName avatarData").lean(),
      isAdmin(userId),
      Cohort.exists({ memberUserIds: userId }),
    ]);
    const supportUnreadCount = await SupportConversation.countDocuments(
      canUpload
        ? { $expr: { $gt: ["$lastUserMessageAt", { $ifNull: ["$lastAdminReadAt", new Date(0)] }] } }
        : {
            userId,
            $expr: { $gt: ["$lastAdminMessageAt", { $ifNull: ["$lastUserReadAt", new Date(0)] }] },
          }
    );
    const displayName = profile?.displayName || session.user.name || "there";
    sidebar = <StudentDashboardSidebar displayName={displayName} avatarData={profile?.avatarData ?? ""} canUpload={canUpload} hasCohorts={!!hasCohorts} supportUnreadCount={supportUnreadCount} />;
  }

  return (
    <>
      <SiteHeader />
      <div className={`mx-auto grid w-full max-w-screen-2xl grid-cols-1 items-start gap-5 px-3 py-6 sm:gap-7 sm:px-5 sm:py-10 md:px-8 lg:gap-8 lg:px-10 ${sidebar ? "lg:grid-cols-[15rem_minmax(0,1fr)]" : ""}`}>
        {sidebar}
        <div className={`min-w-0 ${sidebar ? "" : "lg:col-span-full"}`}>{children}</div>
      </div>
    </>
  );
}
