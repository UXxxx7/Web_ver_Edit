// Unified profile + generation-history data access. Same dispatch pattern
// as lib/auth.ts: real Supabase Postgres once configured, local JSON mock
// (lib/store.ts) until then. See supabase/migrations/0001_init.sql for the
// real schema this mirrors.
import "server-only";
import * as mock from "./store";
import { createClient as createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./auth";
import type { GenerationKind } from "./generation-types";

export type { GenerationKind };

export type Profile = {
  display_name: string;
  role: string;
  preferred_lang: "zh" | "en";
  brand_voice_notes: string;
  avatar_url: string;
};

export type Generation = {
  id: string;
  kind: GenerationKind;
  direction: string;
  result: unknown;
  created_at: string;
};

const EMPTY_PROFILE: Profile = {
  display_name: "", role: "", preferred_lang: "zh", brand_voice_notes: "", avatar_url: "",
};

export async function getProfile(userId: string): Promise<Profile> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data ? { ...EMPTY_PROFILE, ...data } : EMPTY_PROFILE;
  }
  const profile = await mock.getProfile(userId);
  return profile ? { ...EMPTY_PROFILE, ...profile } : EMPTY_PROFILE;
}

export async function upsertProfile(userId: string, fields: Partial<Profile>): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("profiles").upsert({ id: userId, ...fields, updated_at: new Date().toISOString() });
    return;
  }
  await mock.upsertProfile(userId, fields);
}

export async function addGeneration(
  userId: string,
  kind: GenerationKind,
  direction: string,
  result: unknown
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("generations").insert({ user_id: userId, kind, direction, result });
    return;
  }
  await mock.addGeneration({ user_id: userId, kind, direction, result });
}

export async function listGenerations(userId: string): Promise<Generation[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("generations")
      .select("id,kind,direction,result,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  }
  const rows = await mock.listGenerations(userId);
  return rows.slice(0, 50).map((r) => ({
    id: r.id, kind: r.kind, direction: r.direction, result: r.result, created_at: r.created_at,
  }));
}
