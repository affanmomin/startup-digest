import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, appAuthEnabled, safeEqual, sessionToken } from "@/lib/auth";

/**
 * Single-user auth gate. Protects all page routes AND server actions (which POST
 * to page URLs) behind a session cookie. The /api/* routes self-authenticate via
 * CRON_SECRET, so they're excluded here. When APP_PASSWORD/AUTH_SECRET are unset
 * (local dev), the gate is disabled.
 */
export function middleware(req: NextRequest) {
  if (!appAuthEnabled()) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, sessionToken())) {
    return NextResponse.next();
  }

  // Not authenticated → send to /login (preserve intended destination).
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Gate every app page + server action, EXCEPT: the login page, API routes
  // (CRON_SECRET-gated), Next internals, and any static asset (anything with a
  // file extension — icon.svg, favicon.ico, robots.txt, images, etc.).
  matcher: ["/((?!login|api|_next/static|_next/image|.*\\..*).*)"],
};
