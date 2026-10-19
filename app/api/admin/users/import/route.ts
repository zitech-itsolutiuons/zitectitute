import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { parseCsv, csvCell } from "@/lib/csv";
import { UserProfile } from "@/lib/models/UserProfile";
import { User } from "@/lib/models/User";
import { Cohort } from "@/lib/models/Cohort";
import { hashPassword } from "@/lib/password";
import { recordAdminAction } from "@/lib/adminAudit";
import { ensureStudentId } from "@/lib/studentId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportRow = { name: string; email: string; studentId: string; program: string; level: string };

function parseStudentRows(text: string): ImportRow[] {
  const records = parseCsv(text);
  if (records.length < 2) throw new Error("The CSV must contain a header and at least one student.");
  if (records.length > 501) throw new Error("Import up to 500 students per file.");

  const headers = records[0].map((header) => header.trim().toLowerCase());
  const nameIndex = headers.indexOf("name");
  const emailIndex = headers.indexOf("email");
  if (nameIndex < 0 || emailIndex < 0) throw new Error("The CSV needs name and email columns.");
  const value = (record: string[], key: string) => {
    const column = headers.indexOf(key);
    return column < 0 ? "" : (record[column] ?? "").trim();
  };
  return records.slice(1).map((record) => ({
    name: (record[nameIndex] ?? "").trim(),
    email: (record[emailIndex] ?? "").trim().toLowerCase(),
    studentId: value(record, "studentid"),
    program: value(record, "program"),
    level: value(record, "level"),
  }));
}

function validRow(row: ImportRow) {
  return row.name.length > 0 && row.name.length <= 80 &&
    row.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) &&
    row.studentId.length <= 100 && row.program.length <= 120 && row.level.length <= 80;
}

export async function POST(request: Request) {
  const actorId = await getUserId();
  if (!actorId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isAdmin(actorId))) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const cohortId = form.get("cohortId");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_000_000) {
    return NextResponse.json({ error: "Choose a CSV file smaller than 2 MB." }, { status: 400 });
  }
  if (typeof cohortId !== "string" || (cohortId && !/^[a-f\d]{24}$/i.test(cohortId))) {
    return NextResponse.json({ error: "Choose a valid cohort." }, { status: 400 });
  }

  let rows: ImportRow[];
  try {
    rows = parseStudentRows(await file.text());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read this CSV." }, { status: 400 });
  }

  await connectDB();
  const cohort = cohortId ? await Cohort.findById(cohortId).select("_id").lean() : null;
  if (cohortId && !cohort) return NextResponse.json({ error: "That cohort no longer exists." }, { status: 400 });

  const results: string[] = ["name,email,studentId,temporaryPassword,status"];
  const newUserIds: string[] = [];
  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!validRow(row)) {
      results.push([row.name, row.email, row.studentId, "", "invalid row"].map(csvCell).join(","));
      skipped++;
      continue;
    }
    if (await User.exists({ email: row.email })) {
      results.push([row.name, row.email, row.studentId, "", "account already exists"].map(csvCell).join(","));
      skipped++;
      continue;
    }

    const temporaryPassword = `T-${randomBytes(18).toString("base64url")}`;
    try {
      const user = await User.create({
        name: row.name,
        email: row.email,
        passwordHash: await hashPassword(temporaryPassword),
        role: "user",
      });
      try {
        await UserProfile.findOneAndUpdate(
          { userId: user.id },
          { $set: { userId: user.id, displayName: row.name, studentId: row.studentId, program: row.program, level: row.level } },
          { upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );
        const studentId = await ensureStudentId(user.id, row.name);
        results.push([row.name, row.email, studentId, temporaryPassword, "created"].map(csvCell).join(","));
      } catch (error) {
        await User.deleteOne({ _id: user._id });
        throw error;
      }
      newUserIds.push(user.id);
      created++;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        results.push([row.name, row.email, row.studentId, "", "account or profile already exists"].map(csvCell).join(","));
        skipped++;
      } else {
        throw error;
      }
    }
  }

  if (cohortId && newUserIds.length) {
    const membership = await Cohort.updateOne({ _id: cohortId }, { $addToSet: { memberUserIds: { $each: newUserIds } } });
    if (!membership.matchedCount) throw new Error("The selected cohort was removed during import.");
  }
  await recordAdminAction({
    actorId,
    action: "students.bulk-imported",
    targetType: "users",
    targetId: cohortId ?? "",
    details: { created, skipped, rows: rows.length },
  });

  return new NextResponse(results.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="student-import-results.csv"',
      "Cache-Control": "no-store",
      "X-Import-Created": String(created),
      "X-Import-Skipped": String(skipped),
    },
  });
}
