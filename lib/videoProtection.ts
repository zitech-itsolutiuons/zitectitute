import { createHmac, timingSafeEqual } from "node:crypto";

export const VIDEO_URL_TTL_SECONDS = 60 * 60;

function signingSecret() {
  const secret = process.env.VIDEO_SIGNING_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Set VIDEO_SIGNING_SECRET or AUTH_SECRET to protect course media.");
  return secret;
}

function signatureFor(courseId: string, index: number, expires: number) {
  return createHmac("sha256", signingSecret())
    .update(`${courseId}:${index}:${expires}`)
    .digest("base64url");
}

export function signedCourseMediaPath(courseId: string, index: number) {
  const expires = Math.floor(Date.now() / 1000) + VIDEO_URL_TTL_SECONDS;
  const signature = signatureFor(courseId, index, expires);
  return `/api/courses/${courseId}/media/${index}?expires=${expires}&signature=${signature}`;
}

export function verifyCourseMediaSignature(courseId: string, index: number, expiresRaw: string | null, signature: string | null) {
  if (!expiresRaw || !signature || !/^\d{1,12}$/.test(expiresRaw)) return false;
  const expires = Number(expiresRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + VIDEO_URL_TTL_SECONDS + 60) return false;
  const expected = Buffer.from(signatureFor(courseId, index, expires));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function protectCourseMediaUrls(contentMd: string, courseId: string) {
  const escapedCourseId = courseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(/api/courses/${escapedCourseId}/media/(\\d+))(?![^)]*\\?)`, "g");
  return contentMd.replace(pattern, (_match, _path: string, rawIndex: string) =>
    signedCourseMediaPath(courseId, Number(rawIndex))
  );
}

export function restoreCourseMediaUrls(contentMd: string, courseId: string) {
  const escapedCourseId = courseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(/api/courses/${escapedCourseId}/media/\\d+)\\?expires=\\d{1,12}&signature=[\\w-]+`, "g");
  return contentMd.replace(pattern, "$1");
}

export function isAllowedVideoReferrer(referer: string | null, allowedDomains: string[], requestUrl: string) {
  if (!referer) return false;
  let hostname: string;
  try {
    hostname = new URL(referer).hostname.toLowerCase();
  } catch {
    return false;
  }
  const allowlist = allowedDomains.length
    ? allowedDomains.map((domain) => domain.toLowerCase().split(":")[0])
    : [new URL(requestUrl).hostname.toLowerCase()];
  return allowlist.includes(hostname);
}
