// Mock-mode session signing — ONLY used when Supabase isn't configured yet
// (see lib/auth.ts). Once NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set, real
// auth switches to @supabase/ssr's own cookie-based session handling and
// this module goes unused. Signed (HMAC), not just base64, so a local demo
// session can't be trivially forged by editing the cookie value — still
// not production-grade auth (no password reset, no email verification,
// single dev secret) and isn't meant to be.

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
const COOKIE_NAME = "om_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

type SessionPayload = { uid: string; exp: number };

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(uid: string): string {
  const payload: SessionPayload = { uid, exp: Date.now() + MAX_AGE_S * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  // Length must match before timingSafeEqual — it throws on mismatched buffer sizes.
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE_S };
