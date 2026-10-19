export type AchievementBadgeMetric = {
  key: "streak" | "modules" | "courses";
  label: string;
  value: number;
  unit: string;
  singularUnit: string;
  tiers: { name: string; threshold: number }[];
};

export const ACHIEVEMENT_BADGE_TIERS: AchievementBadgeMetric[] = [
  {
    key: "streak",
    label: "Login streak",
    value: 0,
    unit: "days",
    singularUnit: "day",
    tiers: [
      { name: "First Spark", threshold: 3 },
      { name: "Steady Learner", threshold: 7 },
      { name: "Fortnight Focus", threshold: 14 },
      { name: "Monthly Momentum", threshold: 30 },
      { name: "Century Scholar", threshold: 100 },
    ],
  },
  {
    key: "modules",
    label: "Modules completed",
    value: 0,
    unit: "modules",
    singularUnit: "module",
    tiers: [
      { name: "First Steps", threshold: 1 },
      { name: "Module Explorer", threshold: 5 },
      { name: "Knowledge Builder", threshold: 10 },
      { name: "Practice Pro", threshold: 25 },
      { name: "Master of Modules", threshold: 50 },
    ],
  },
  {
    key: "courses",
    label: "Courses completed",
    value: 0,
    unit: "courses",
    singularUnit: "course",
    tiers: [
      { name: "Course Finisher", threshold: 1 },
      { name: "Triple Graduate", threshold: 3 },
      { name: "Learning Champion", threshold: 5 },
      { name: "Course Collector", threshold: 10 },
    ],
  },
];

export function getAchievementBadgeMetrics(values: {
  longestStreak: number;
  completedModules: number;
  completedCourses: number;
}): AchievementBadgeMetric[] {
  const valuesByKey: Record<AchievementBadgeMetric["key"], number> = {
    streak: values.longestStreak,
    modules: values.completedModules,
    courses: values.completedCourses,
  };
  return ACHIEVEMENT_BADGE_TIERS.map((metric) => ({
    ...metric,
    value: valuesByKey[metric.key],
  }));
}
