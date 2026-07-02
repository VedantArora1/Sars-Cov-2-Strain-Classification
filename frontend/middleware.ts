import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "./lib/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthPage = pathname === "/" || pathname === "/register";
  const isProtected =
    pathname.startsWith("/jobs") ||
    pathname.startsWith("/upload") ||
    pathname.startsWith("/samples");

  if (!isAuthenticated && isProtected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/register", "/dashboard/:path*", "/jobs/:path*", "/upload/:path*", "/samples/:path*"]
};
