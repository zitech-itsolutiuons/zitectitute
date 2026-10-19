import { auth } from "@/auth";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";

/**
 * The signed-in user's id, or null when signed out or platform-restricted.
 * Callers decide the response: API routes return 401, pages redirect to /signin.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.platformRestricted) return null;
  return session?.user?.id ?? null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;
  await connectDB();
  return Boolean(await User.exists({ _id: userId, role: "admin" }));
}
