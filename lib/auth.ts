import { NextRequest, NextResponse } from "next/server";

/** Name of the single-user session cookie. */
export const AUTH_COOKIE = "sd_session";

/**
 * Whether the app-level auth gate is active. Off when APP_PASSWORD/AUTH_SECRET
 * are unset (local dev convenience); on as soon as both are configured.
 */
export function appAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}

/** The opaque token value a valid session cookie must hold. */
export function sessionToken(): string {
  return process.env.AUTH_SECRET ?? "";
}

/** Constant-time-ish string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Lightweight protection for cron + mutation routes (single-user MVP).
 * Accepts the shared CRON_SECRET via either:
 *   - Authorization: Bearer <secret>
 *   - ?secret=<secret>
 */
export function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // If no secret is configured, fail closed in production but allow in dev so
  // the app is usable locally before env is fully set up.
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret && querySecret === secret) return true;

  return false;
}

/** Returns a 401 response if the request is not authorized, else null. */
export function requireAuth(req: NextRequest): NextResponse | null {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  return null;
}
