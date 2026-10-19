import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import mongoose from "mongoose";
import nextEnv from "@next/env";

const { model, models, Schema } = mongoose;
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.SEED_ADMIN_NAME?.trim();
const password = process.env.SEED_ADMIN_PASSWORD;
const mongoUri = process.env.MONGODB_URI;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Set a valid SEED_ADMIN_EMAIL in .env.local");
if (!name || name.length > 80) throw new Error("Set SEED_ADMIN_NAME to a value of 1-80 characters");
if (!password || password.length < 8 || password.length > 128)
  throw new Error("Set SEED_ADMIN_PASSWORD to a value of 8-128 characters");
if (!mongoUri) throw new Error("Set MONGODB_URI in .env.local");

const User =
  models.User ||
  model(
    "User",
    new Schema(
      {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ["user", "admin"], default: "user", required: true },
        failedLogins: { type: Number, default: 0 },
        lockedUntil: Date,
      },
      { timestamps: true }
    )
  );

const scrypt = promisify(scryptCallback);

async function hashPassword(value) {
  const salt = randomBytes(16);
  const key = await scrypt(value.normalize("NFKC"), salt, 64, {
    N: 2 ** 15,
    r: 8,
    p: 1,
    maxmem: 128 * 2 ** 15 * 8 * 2,
  });
  return ["scrypt", 2 ** 15, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");
}

try {
  await mongoose.connect(mongoUri);
  await User.init();
  await User.updateOne(
    { email },
    {
      $set: { email, name, role: "admin" },
      $setOnInsert: { passwordHash: await hashPassword(password), failedLogins: 0 },
    },
    { upsert: true }
  );
  console.log(`Admin account is ready: ${email}`);
} finally {
  await mongoose.disconnect();
}