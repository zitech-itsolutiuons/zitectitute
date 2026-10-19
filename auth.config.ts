import type { NextAuthConfig } from "next-auth";
import type { DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "instructor" | "admin";
      platformRestricted: boolean;
      loginStreakKey?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "user" | "instructor" | "admin";
  }
}

import { USER_IDLE_TIMEOUT_MS } from "./lib/sessionPolicy";

type UserRole = "user" | "instructor" | "admin";

/**
 * Edge-safe half of the Auth.js config. It must not import Mongoose or anything
 * Node-only, because middleware.ts runs it on the edge runtime. The email/password
 * provider (which needs the database) is added in auth.ts.
 * A provider is enabled only when its AUTH_<PROVIDER>_ID env var is set.
 */
const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_GITHUB_ID) providers.push(GitHub);

export default {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user, account, trigger }) {
      const claims = token as typeof token & {
        role?: UserRole;
        lastActivityAt?: number;
        platformRestricted?: boolean;
        loginStreakKey?: string;
      };
      const now = Date.now();
      if (user) {
        claims.role = user.role ?? "user";
        claims.lastActivityAt = now;
      } else if (typeof claims.lastActivityAt !== "number") {
        claims.lastActivityAt = typeof token.iat === "number" ? token.iat * 1000 : now;
      }
      if (user && account) claims.loginStreakKey = `${account.provider}:${user.id}`;

      if (claims.role && claims.role !== "admin" && now - claims.lastActivityAt! >= USER_IDLE_TIMEOUT_MS) return null;
      if (trigger === "update" && claims.role !== "admin") claims.lastActivityAt = now;
      return claims;
    },
    async redirect({ url, baseUrl }) {
      const dashboardUrl = `${baseUrl}/courses`;

      if (url.includes("/api/auth/callback/credentials")) return dashboardUrl;
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();

      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
      } catch {
        // Ignore malformed URLs and fall back to the dashboard.
      }

      return dashboardUrl;
    },
    session({ session, token }) {
      const claims = token as typeof token & {
        role?: UserRole;
        platformRestricted?: boolean;
        loginStreakKey?: string;
      };
      if (token.sub) session.user.id = token.sub;
      session.user.role = claims.role === "admin" || claims.role === "instructor" ? claims.role : "user";
      session.user.platformRestricted = claims.platformRestricted === true;
      session.user.loginStreakKey = claims.loginStreakKey;
      return session;
    },
  },
} satisfies NextAuthConfig;
