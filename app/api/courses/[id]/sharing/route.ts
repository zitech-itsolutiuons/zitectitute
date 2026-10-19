import { authorizeOwner } from "@/lib/access";
import { setSharing } from "@/lib/courseOps";
import { json, parseBody } from "@/lib/http";
import { SharingBody } from "@/lib/validation";

/** { enabled?: boolean, reset?: boolean }: turn the join link on/off, or replace it with a new one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeOwner(id);
  if (auth instanceof Response) return auth;
  if (auth.course.status !== "ready") return json({ error: "The course is not ready to share yet" }, 409);
  const body = await parseBody(req, SharingBody);
  if ("res" in body) return body.res;
  return json(await setSharing(id, body.data));
}
