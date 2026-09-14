import { NextResponse, type NextRequest } from "next/server";
import { createProxySupabaseClient } from "@/lib/supabase/proxy-client";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];
const AUTH_ROUTES = ["/login", "/register"];

/**
 * Runs on every request (Next.js 16 renamed `middleware` to `proxy`).
 * Responsibilities:
 *  1. Refresh the Supabase auth session cookie so it never silently expires.
 *  2. Gate all protected routes — unauthenticated users are bounced to /login.
 *  3. Keep authenticated users out of /login and /register.
 * Business-status redirects (waiting vs. positions vs. my-position, admin
 * role checks) live in the page/layout server components, not here.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, getResponse } = createProxySupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublicRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
