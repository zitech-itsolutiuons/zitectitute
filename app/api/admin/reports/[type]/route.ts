import { NextResponse } from "next/server";
import { ADMIN_REPORT_ROW_LIMIT, loadActivityReport, loadPaymentReport, type AdminReportFilters } from "@/lib/adminReports";
import { getUserId, isAdmin } from "@/lib/auth";
import { csvCell } from "@/lib/csv";
import { recordAdminAction } from "@/lib/adminAudit";

export const dynamic = "force-dynamic";

function dateParam(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const actorId = await getUserId();
  if (!actorId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isAdmin(actorId))) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { type } = await params;
  if (type !== "payments" && type !== "activity") return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  const url = new URL(request.url);
  const today = new Date();
  const toDay = dateParam(url.searchParams.get("to"), new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
  const from = dateParam(url.searchParams.get("from"), new Date(toDay.getTime() - 30 * 24 * 60 * 60 * 1000));
  const filters: AdminReportFilters = {
    from,
    to: new Date(toDay.getTime() + 24 * 60 * 60 * 1000),
    ...(url.searchParams.get("courseId") && /^[a-f\d]{24}$/i.test(url.searchParams.get("courseId")!) ? { courseId: url.searchParams.get("courseId")! } : {}),
    ...(url.searchParams.get("cohortId") && /^[a-f\d]{24}$/i.test(url.searchParams.get("cohortId")!) ? { cohortId: url.searchParams.get("cohortId")! } : {}),
  };

  const rows = type === "payments" ? await loadPaymentReport(filters) : await loadActivityReport(filters);
  if (rows.length > ADMIN_REPORT_ROW_LIMIT) {
    return NextResponse.json(
      { error: `This report exceeds ${ADMIN_REPORT_ROW_LIMIT.toLocaleString()} rows. Narrow the date range or filters and try again.` },
      { status: 422 },
    );
  }
  const header = type === "payments"
    ? ["date", "email", "student", "course", "amount_kobo", "status", "source", "reference"]
    : ["last_active", "email", "student", "student_id", "course", "completed_chapters", "total_chapters", "completion_percent", "quiz_attempts"];
  const data = rows.map((row) => {
    if (type === "payments" && "amountKobo" in row) {
      return [row.date.toISOString(), row.email, row.student, row.course, row.amountKobo, row.status, row.source, row.reference];
    }
    if ("completionPercent" in row) {
      return [row.date.toISOString(), row.email, row.student, row.studentId, row.course, row.completed, row.total, row.completionPercent, row.quizAttempts];
    }
    return [];
  });
  await recordAdminAction({
    actorId,
    action: `reports.${type}.exported`,
    targetType: "report",
    details: { rows: data.length, courseId: filters.courseId ?? null, cohortId: filters.cohortId ?? null },
  });
  const csv = [header, ...data].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-report.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
