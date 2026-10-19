/** Only same-site relative paths are allowed as a post-login destination (no open redirects). */
export const safePath = (p?: string | null) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/courses");
