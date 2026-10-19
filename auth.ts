import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import authConfig from "./auth.config";
import { verifyCredentials } from "./lib/users";
import { connectDB } from "./lib/db";
import { User } from "./lib/models/User";
import { USER_IDLE_TIMEOUT_MS } from "./lib/sessionPolicy";
import { isValidObjectId } from "mongoose";
import { recordLoginStreak } from "./lib/loginStreak";

/**
 * Full Auth.js config (Node runtime): OAuth providers from auth.config.ts plus
 * email/password. JWT sessions are required for the Credentials provider.
 * User ids: email/password users use their MongoDB ObjectId, OAuth users use the
 * provider's account id. The two never collide, and the same person using several
 * methods gets separate accounts (no linking yet).
 */
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(raw);
        return parsed.success ? verifyCredentials(parsed.data.email, parsed.data.password) : null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt!(params);
      if (!token) return null;
      const claims = token as typeof token & {
        role?: "user" | "instructor" | "admin";
        lastActivityAt?: number;
        sessionVersion?: number;
        platformRestricted?: boolean;
      };

      if (token.sub && isValidObjectId(token.sub)) {
        await connectDB();
        const user = await User.findById(token.sub).select("role sessionVersion platformRestrictedAt").lean();
        if (!user) return null;
        const sessionVersion = user.sessionVersion ?? 0;
        if (claims.sessionVersion === undefined && sessionVersion > 0 && !params.user) return null;
        if (claims.sessionVersion !== undefined && claims.sessionVersion !== sessionVersion) return null;
        claims.sessionVersion = sessionVersion;
        claims.role = user.role === "admin" || user.role === "instructor" ? user.role : "user";
        claims.platformRestricted = user.role === "user" && Boolean(user.platformRestrictedAt);
      }

      const now = Date.now();
      const lastActivityAt = typeof claims.lastActivityAt === "number" ? claims.lastActivityAt : now;
      if (claims.role !== "admin" && now - lastActivityAt >= USER_IDLE_TIMEOUT_MS) return null;
      if (params.trigger === "update" && claims.role !== "admin") claims.lastActivityAt = now;
      return claims;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!account || user.role === "admin") return;
      try {
        await recordLoginStreak(`${account.provider}:${user.id}`);
      } catch (error) {
        console.error("Could not record login streak", error);
      }
    },
  },
});
