// Real-mode Supabase browser client. Only used once NEXT_PUBLIC_SUPABASE_URL
// / NEXT_PUBLIC_SUPABASE_ANON_KEY are set (see lib/auth.ts, lib/data.ts) —
// safe to import even before those are configured, it just won't be called.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
