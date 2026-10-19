import StudentQuizLimitForm from "@/components/admin/StudentQuizLimitForm";
import AchievementBadgesSettingForm from "@/components/admin/AchievementBadgesSettingForm";
import { connectDB } from "@/lib/db";
import { PlatformSettings } from "@/lib/models/PlatformSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await connectDB();
  const settings = await PlatformSettings.findOne({ key: "platform" })
    .select("studentQuizQuestionLimit achievementBadgesEnabled")
    .lean();

  return (
    <section aria-labelledby="settings-heading" className="max-w-3xl space-y-10">
      <header>
        <h2 id="settings-heading" className="text-xl font-semibold text-slate-900">Platform settings</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Manage student quiz access across the platform.</p>
      </header>
      <section aria-labelledby="quiz-settings-heading" className="space-y-2">
        <h3 id="quiz-settings-heading" className="text-lg font-semibold text-slate-900">Module quizzes</h3>
        <StudentQuizLimitForm limit={settings?.studentQuizQuestionLimit ?? 15} />
      </section>
      <section aria-labelledby="achievement-settings-heading" className="space-y-2">
        <h3 id="achievement-settings-heading" className="text-lg font-semibold text-slate-900">Achievement badges</h3>
        <AchievementBadgesSettingForm enabled={settings?.achievementBadgesEnabled ?? false} />
      </section>
    </section>
  );
}