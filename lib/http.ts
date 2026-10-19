import { NextResponse } from "next/server";
import type { z } from "zod";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Parses and validates a JSON body. Returns { data } or a ready-made 400 response as { res }. */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { res: Response }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  return parsed.success
    ? { data: parsed.data }
    : { res: json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400) };
}
