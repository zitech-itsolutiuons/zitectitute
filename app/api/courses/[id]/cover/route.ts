import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Course, CourseMedia } from "@/lib/models/Course";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isValidObjectId(id)) return new NextResponse("Not found", { status: 404 });

  await connectDB();
  const course = await Course.exists({ _id: id, catalogVisible: true, archivedAt: null });
  if (!course) return new NextResponse("Not found", { status: 404 });

  const cover = await CourseMedia.findOne({ courseId: id, index: -1 }).select("contentType data").lean();
  if (!cover) return new NextResponse("Not found", { status: 404 });

  const data = Buffer.from(cover.data.buffer.subarray(0, cover.data.position));
  return new NextResponse(data, {
    headers: {
      "Content-Type": cover.contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
