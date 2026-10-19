import mongoose from "mongoose";

const g = globalThis as unknown as { _mongoose?: Promise<typeof mongoose> };

/** Reuses one connection across hot reloads and serverless invocations. */
export function connectDB() {
  if (!g._mongoose) g._mongoose = mongoose.connect(process.env.MONGODB_URI!);
  return g._mongoose;
}
