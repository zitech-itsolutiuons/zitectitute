import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { UserProfile } from "@/lib/models/UserProfile";
import { ensureStudentId } from "@/lib/studentId";

export const runtime = "nodejs";

const ProfileFields = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer for your name"),
  bio: z.string().trim().max(500, "About you must be 500 characters or fewer"),
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const form = await req.formData();
  const value = (key: string) => {
    const entry = form.get(key);
    return typeof entry === "string" ? entry : "";
  };
  const parsed = ProfileFields.safeParse({
    displayName: value("displayName"),
    bio: value("bio"),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your profile details" }, { status: 400 });

  const avatar = form.get("avatar");
  let avatarData: string | undefined;
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "Profile photos must be 2 MB or smaller" }, { status: 413 });
    const bytes = Buffer.from(await avatar.arrayBuffer());
    const contentType = imageType(bytes);
    if (!contentType) return NextResponse.json({ error: "Choose a PNG, JPG, or WebP image" }, { status: 415 });
    avatarData = `data:${contentType};base64,${bytes.toString("base64")}`;
  }

  await connectDB();
  await ensureStudentId(userId, parsed.data.displayName);
  const fields = parsed.data;
  if (value("removeAvatar") === "true") {
    await UserProfile.findOneAndUpdate(
      { userId },
      { $set: fields, $unset: { avatarData: 1 } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    await UserProfile.findOneAndUpdate(
      { userId },
      { $set: avatarData ? { ...fields, avatarData } : fields },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  return NextResponse.json({ ok: true });
}