import { randomBytes, scryptSync, createCipheriv } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { EJSON } from "bson";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/adminAudit";
import { getUserId, isAdmin } from "@/lib/auth";
import { connectDB } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
const MAGIC = Buffer.from("ZTBK1");

export async function GET() {
  const actorId = await getUserId();
  if (!actorId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isAdmin(actorId))) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const password = process.env.BACKUP_ENCRYPTION_KEY;
  if (!password || password.length < 32) {
    return NextResponse.json({ error: "Set BACKUP_ENCRYPTION_KEY to a secret with at least 32 characters before creating backups." }, { status: 503 });
  }

  await connectDB();
  const database = mongoose.connection.db;
  if (!database) return NextResponse.json({ error: "The database connection is not ready." }, { status: 503 });
  const collectionNames = (await database.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const chunks: Buffer[] = [];
  let plainBytes = 0;

  async function* dumpDatabase(db: NonNullable<typeof database>) {
    const metadata = EJSON.stringify({ format: "zitech-backup-v1", createdAt: new Date(), collections: collectionNames }, { relaxed: false });
    yield `{"metadata":${metadata},"data":{`;
    for (let collectionIndex = 0; collectionIndex < collectionNames.length; collectionIndex++) {
      const name = collectionNames[collectionIndex];
      if (collectionIndex) yield ",";
      yield `${JSON.stringify(name)}:[`;
      const cursor = db.collection(name).find({}, { batchSize: 100 });
      let first = true;
      try {
        for await (const document of cursor) {
          const record = EJSON.stringify(document, { relaxed: false });
          plainBytes += Buffer.byteLength(record);
          if (plainBytes > MAX_BACKUP_BYTES) throw new Error("Backup exceeded the 512 MB uncompressed safety limit. Narrow or split the database before retrying.");
          yield `${first ? "" : ","}${record}`;
          first = false;
        }
      } finally {
        await cursor.close();
      }
      yield "]";
    }
    yield "}}";
  }

  await pipeline(
    Readable.from(dumpDatabase(database)),
    createGzip(),
    cipher,
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    })
  );
  const tag = cipher.getAuthTag();
  const backup = Buffer.concat([MAGIC, salt, iv, tag, ...chunks]);
  await recordAdminAction({
    actorId,
    action: "backups.created",
    targetType: "database",
    details: { collections: collectionNames.length, bytes: backup.length },
  });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(backup, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="zitech-backup-${date}.ztbackup"`,
      "Cache-Control": "no-store",
      "X-Backup-Format": "ZTBK1",
    },
  });
}
