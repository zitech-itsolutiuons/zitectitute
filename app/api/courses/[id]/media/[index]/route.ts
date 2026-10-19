import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CourseMedia } from "@/lib/models/Course";
import { isAllowedVideoReferrer, verifyCourseMediaSignature } from "@/lib/videoProtection";

type Ctx = { params: Promise<{ id: string; index: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id, index: rawIndex } = await params;
  const index = Number(rawIndex);
  if (!isValidObjectId(id) || !Number.isSafeInteger(index) || index < 0) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = new URL(_req.url);
  if (!verifyCourseMediaSignature(id, index, url.searchParams.get("expires"), url.searchParams.get("signature"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  await connectDB();
  const allowedDomains = (process.env.VIDEO_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => /^[a-z\d.-]+(?::\d{1,5})?$/.test(domain));
  if (!isAllowedVideoReferrer(_req.headers.get("referer"), allowedDomains, _req.url)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const media = await CourseMedia.findOne({ courseId: id, index }).select("contentType data").lean();
  if (!media) return new NextResponse("Not found", { status: 404 });

  const data = Buffer.from(media.data.buffer.subarray(0, media.data.position));
  return new NextResponse(data, {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}