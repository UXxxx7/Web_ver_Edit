// Session gate. Named proxy.ts, not middleware.ts — Next.js 16 renamed the
// convention (middleware.js is deprecated, see node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/proxy.md). Same job either
// way: redirect unauthenticated requests to /login.
//
// Dispatches on whether Supabase is configured, same as lib/auth.ts — but
// can't import that module directly (it's server-only and pulls in
// node:crypto/bcryptjs/fs-backed lib/store.ts, more than a proxy needs);
// duplicates just the "is there a valid session" check for each mode.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./lib/session";

const PUBLIC_PATHS = ["/login", "/signup"];

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isSupabaseConfigured()) {
    const authed = Boolean(verifySessionToken(request.cookies.get(COOKIE_NAME)?.value));
    if (!authed && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
    if (authed && isPublic) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  // Real Supabase mode — standard @supabase/ssr session-refresh pattern.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const authed = Boolean(data.user);
  if (!authed && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (authed && isPublic) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
