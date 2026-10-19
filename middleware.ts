import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";

// Edge runtime: use the edge-safe config only (no database code).
const { auth } = NextAuth(authConfig);

/**
 * First line of defence: send signed-out visitors to /signin for study and join
 * routes. Published course overview pages are public; their page handler checks
 * catalogue visibility and learner restrictions.
 */
export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isCourseOverview = /^\/courses\/[a-f\d]{24}\/overview$/i.test(pathname);
  const isRestricted = req.auth?.user?.platformRestricted === true;

  const restrictedAuthAction = pathname === "/api/auth/signout"
    || (pathname === "/api/auth/csrf" && (req.method === "GET" || req.method === "HEAD"));
  if (isRestricted && !restrictedAuthAction) {
    if ((req.method === "GET" || req.method === "HEAD") && pathname === "/courses") {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-pathname", pathname);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "This account is restricted from platform access." }, { status: 403 });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new NextResponse("This account is restricted from platform access.", { status: 403 });
    }

    return NextResponse.redirect(new URL("/courses", req.url));
  }

  const isProtectedStudyRoute = pathname.startsWith("/courses/") || pathname === "/courses"
    || pathname.startsWith("/join/");
  if (!req.auth && isProtectedStudyRoute && !isCourseOverview) {
    const url = new URL("/signin", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
