// Route Handler, not a plain redirect from a Server Component — cookies
// can only be written (set/delete) from a Server Action, Route Handler, or
// Middleware; a Server Component render is read-only for cookies (Next.js
// throws "Cookies can only be modified in a Server Action or Route
// Handler" otherwise — hit exactly this live, see app/(app)/layout.tsx's
// own comment on why it redirects here instead of calling signOut()
// directly). This is the one place that actually clears a session cookie
// that verified as validly-signed but pointed at a user that no longer
// exists, breaking the /login <-> "/" redirect loop that situation causes
// (proxy.ts sees "authed" from the signature alone and won't let you stay
// on /login; the page-level user lookup here finds nobody and sends you
// back — neither side clears the cookie causing the disagreement unless
// something does it explicitly).
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

export async function GET(request: Request) {
  // Not `new URL("/login", request.url)` — behind nginx's proxy_pass,
  // request.url reflects the *internal* Docker hostname/port this
  // container is actually listening on (confirmed live: a real redirect
  // came back pointing at "https://<container-id>:3000/login", which no
  // browser outside the Docker network can resolve). nginx.conf already
  // forwards the real client-facing host/scheme via X-Forwarded-Host/
  // X-Forwarded-Proto — build the redirect target from those instead, the
  // same information proxy.ts's NextRequest-based redirects get resolved
  // through automatically.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const response = NextResponse.redirect(new URL("/login", `${proto}://${host}`));
  response.cookies.delete(COOKIE_NAME);
  return response;
}
