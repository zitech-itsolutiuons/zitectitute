import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { connectDB } from "./db";
import { PlatformSettings } from "./models/PlatformSettings";

export function hashSignupCode(code: string) {
  return createHash("sha256").update(code.trim().replace(/-/g, "").toUpperCase()).digest("hex");
}

function signupCodeEncryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to encrypt signup codes.");
  return createHash("sha256").update(`course-craft:signup-code:v1:${secret}`).digest();
}

export function encryptSignupCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", signupCodeEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSignupCode(encryptedCode?: string | null) {
  if (!encryptedCode) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = encryptedCode.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", signupCodeEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function isSignupCodeRequired() {
  await connectDB();
  const settings = await PlatformSettings.findOne({ key: "platform" }).select("requireSignupCode").lean();
  return settings?.requireSignupCode ?? true;
}