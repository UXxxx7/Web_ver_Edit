// Real-mode Supabase server client (Server Components, Server Actions,
// Route Handlers). Only used once NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set
// — see lib/auth.ts / lib/data.ts, which dispatch to the mock store
// (lib/store.ts) until then.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render (cookies are read-only
            // there) — harmless, proxy.ts refreshes the session cookie on
            // the next navigation. Only Server Actions/Route Handlers can
            // actually write cookies.
          }
        },
      },
    }
  );
}
