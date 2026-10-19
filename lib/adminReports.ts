import { connectDB } from "./db";
import { Cohort } from "./models/Cohort";
import { Course } from "./models/Course";
import { CoursePayment } from "./models/CourseCommerce";
import { User } from "./models/User";
import { UserProfile } from "./models/UserProfile";
import { StudentProgress } from "./models/Course";

export type AdminReportFilters = {
  from: Date;
  to: Date;
  courseId?: string;
  cohortId?: string;
};

export type PaymentReportRow = {
  date: Date;
  email: string;
  student: string;
  course: string;
  amountKobo: number;
  status: string;
  source: string;
  reference: string;
};

export type ActivityReportRow = {
  date: Date;
  email: string;
  student: string;
  studentId: string;
  course: string;
  completed: number;
  total: number;
  completionPercent: number;
  quizAttempts: number;
};

export const ADMIN_REPORT_ROW_LIMIT = 10_000;

async function filterUserIds(cohortId?: string) {
  if (!cohortId) return undefined;
  const cohort = await Cohort.findById(cohortId).select("memberUserIds").lean();
  return cohort?.memberUserIds ?? [];
}

async function userLabels(userIds: string[]) {
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("name email").lean(),
    UserProfile.find({ userId: { $in: userIds } }).select("userId displayName studentId").lean(),
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const profileById = new Map(profiles.map((profile) => [profile.userId, profile]));
  return (userId: string) => ({
    email: userById.get(userId)?.email ?? "",
    student: profileById.get(userId)?.displayName ?? userById.get(userId)?.name ?? "",
    studentId: profileById.get(userId)?.studentId ?? "",
  });
}

export async function loadPaymentReport(filters: AdminReportFilters): Promise<PaymentReportRow[]> {
  await connectDB();
  const members = await filterUserIds(filters.cohortId);
  if (members && members.length === 0) return [];
  const query: Record<string, unknown> = {
    createdAt: { $gte: filters.from, $lt: filters.to },
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(members ? { userId: { $in: members } } : {}),
  };
  const payments = await CoursePayment.find(query).sort({ createdAt: -1 }).limit(ADMIN_REPORT_ROW_LIMIT + 1).lean();
  const [labels, courses] = await Promise.all([
    userLabels([...new Set(payments.map((payment) => payment.userId))]),
    Course.find({ _id: { $in: [...new Set(payments.map((payment) => payment.courseId))] } }).select("title").lean(),
  ]);
  const courseById = new Map(courses.map((course) => [String(course._id), course.title]));
  return payments.map((payment) => ({
    date: payment.createdAt,
    ...labels(payment.userId),
    course: courseById.get(String(payment.courseId)) ?? "Deleted course",
    amountKobo: payment.amountKobo,
    status: payment.status,
    source: payment.promoCodeId ? "Paystack (promo code)" : "Paystack",
    reference: payment.reference,
  }));
}

export async function loadActivityReport(filters: AdminReportFilters): Promise<ActivityReportRow[]> {
  await connectDB();
  const members = await filterUserIds(filters.cohortId);
  if (members && members.length === 0) return [];
  const query: Record<string, unknown> = {
    updatedAt: { $gte: filters.from, $lt: filters.to },
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(members ? { userId: { $in: members } } : {}),
  };
  const progressRows = await StudentProgress.find(query).sort({ updatedAt: -1 }).limit(ADMIN_REPORT_ROW_LIMIT + 1).lean();
  const [labels, courses] = await Promise.all([
    userLabels([...new Set(progressRows.map((progress) => progress.userId))]),
    Course.find({ _id: { $in: [...new Set(progressRows.map((progress) => progress.courseId))] } }).select("title chapterCount").lean(),
  ]);
  const courseById = new Map(courses.map((course) => [String(course._id), course]));
  return progressRows.map((progress) => {
    const course = courseById.get(String(progress.courseId));
    const total = course?.chapterCount ?? 0;
    const completed = Math.min(total, (progress.completedChapterIds ?? []).length);
    return {
      date: progress.updatedAt,
      ...labels(progress.userId),
      course: course?.title ?? "Deleted course",
      completed,
      total,
      completionPercent: total ? Math.round((completed / total) * 100) : 0,
      quizAttempts: (progress.quizAttempts ?? []).length,
    };
  });
}
