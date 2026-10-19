import { z } from "zod";
import { connectDB } from "./db";
import { PlatformSettings } from "./models/PlatformSettings";
import { SignupCode } from "./models/SignupCode";
import { User } from "./models/User";
import { UserProfile } from "./models/UserProfile";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import { hashSignupCode } from "./signupCodes";
import { ensureStudentId } from "./studentId";

export const SignUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer for your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use 128 characters or fewer"),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function createUser(input: SignUpInput, signupCode: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await connectDB();
  const settings = await PlatformSettings.findOne({ key: "platform" }).select("requireSignupCode").lean();
  const normalizedCode = signupCode.trim();
  const signupCodeRecord = normalizedCode
    ? await SignupCode.findOne({ codeHash: hashSignupCode(normalizedCode), active: true }).select("_id")
    : null;
  if (settings?.requireSignupCode ?? true) {
    if (!signupCodeRecord)
      return { ok: false, error: "Enter a valid signup code." };
  }

  const exists = { ok: false as const, error: "An account with this email already exists. Sign in instead." };
  if (await User.exists({ email: input.email })) return exists;
  let createdUserId: string | undefined;
  try {
    const user = await User.create({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      ...(signupCodeRecord ? { signupCodeId: signupCodeRecord._id } : {}),
    });
    createdUserId = user.id;
    await ensureStudentId(user.id, input.name);
    return { ok: true, id: user.id };
  } catch (err) {
    if (createdUserId) await User.deleteOne({ _id: createdUserId });
    if ((err as { code?: number }).code === 11000) return exists; // lost a race with the unique index
    throw err;
  }
}

/**
 * Returns the user on success, null otherwise. Failure looks identical whether the
 * email is unknown, the password is wrong, or the account is temporarily locked.
 * A dummy hash is verified for unknown or locked accounts so timing doesn't leak which case it was.
 */
export async function verifyCredentials(email: string, password: string) {
  await connectDB();
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || (user.lockedUntil && user.lockedUntil > new Date())) {
    await verifyPassword(password, await dummyHash());
    return null;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const updated = await User.findByIdAndUpdate(user._id, { $inc: { failedLogins: 1 } }, { new: true });
    if (updated && updated.failedLogins >= MAX_FAILS)
      await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MS), failedLogins: 0 } });
    return null;
  }
  if (user.failedLogins || user.lockedUntil)
    await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockedUntil: 1 } });
  return { id: user.id as string, name: user.name, email: user.email, role: user.role as "user" | "instructor" | "admin" };
}
