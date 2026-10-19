import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.COURSE_CRAFT_NEXT_DIST_DIR ?? (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),
  // Keep Node-only parsers and Mastra out of the bundler.
  serverExternalPackages: ["pdf-parse", "mammoth", "@napi-rs/canvas", "@mastra/*"],
  async headers() {
    const allowedDomains = (process.env.VIDEO_ALLOWED_DOMAINS ?? "")
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => /^[a-z\d.-]+(?::\d{1,5})?$/.test(domain))
      .map((domain) => `https://${domain}`);
    return [{
      source: "/:path*",
      headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self'${allowedDomains.length ? ` ${allowedDomains.join(" ")}` : ""}` }],
    }];
  },
};

export default nextConfig;
