import { connectDB } from "./db";
import { AdminAuditLog } from "./models/AdminAuditLog";

export async function recordAdminAction(input: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, string | number | boolean | null>;
}) {
  await connectDB();
  await AdminAuditLog.create({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? "",
    details: input.details ?? {},
  });
}
