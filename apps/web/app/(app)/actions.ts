"use server";

import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";
import { addGeneration, getProfile } from "@/lib/data";
import type { Beat, GenerationKind } from "@/lib/generation-types";

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

const ENDPOINTS: Record<GenerationKind, string> = {
  video_script: "/video-scripts",
  shooting_script: "/shooting-scripts",
  content_idea: "/content-ideas",
  combined_script: "/combined-scripts",
};
const RESULT_KEYS: Record<GenerationKind, string> = {
  video_script: "script",
  shooting_script: "script",
  content_idea: "idea",
  combined_script: "script",
};

export type GenerateResult = { result: unknown } | { error: string };

// Called directly from the client (BrainstormTool) as a Server Function —
// not a <form action>. Orchestrates: read the caller's profile (for
// brand_voice_notes) -> call apps/api (server-to-server, no CORS needed,
// apps/api never talks to the browser directly) -> persist to history.
export async function generateContentAction(
  kind: GenerationKind,
  direction: string,
  lang: "zh" | "en",
  movement?: string // only combined_script reads this; apps/api defaults it if omitted
): Promise<GenerateResult> {
  const user = await requireUser();
  direction = direction.trim();
  if (!direction) return { error: "Give a direction first." };

  const profile = await getProfile(user.id);
  const apiBase = process.env.API_BASE_URL || "http://localhost:8001";

  let res: Response;
  try {
    res = await fetch(`${apiBase}${ENDPOINTS[kind]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, lang, brand_voice_notes: profile.brand_voice_notes, movement }),
      cache: "no-store",
    });
  } catch {
    return { error: "Couldn't reach the generator service — is apps/api running?" };
  }

  if (!res.ok) return { error: "Generation failed — try rephrasing, or a different topic." };
  const data = await res.json();
  const result = data[RESULT_KEYS[kind]];
  if (!result) return { error: "Generation failed — try rephrasing, or a different topic." };

  await addGeneration(user.id, kind, direction, result);
  return { result };
}

export type ExtendResult =
  | { beats: Beat[]; estimated_duration_seconds: number | null }
  | { error: string };

// Continues an already-shown combined_script result with a few more beats,
// instead of regenerating the whole thing — called from ResultCard's
// "generate more" button once the user has seen a result they like. Not
// persisted back into generation history (the original addGeneration call
// already saved the base result); this just extends what's on screen.
export async function extendCombinedScriptAction(
  direction: string,
  lang: "zh" | "en",
  movement: string | undefined,
  beats: Beat[]
): Promise<ExtendResult> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const apiBase = process.env.API_BASE_URL || "http://localhost:8001";

  let res: Response;
  try {
    res = await fetch(`${apiBase}/combined-scripts/more`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction, lang, movement: movement || "walk", beats,
        brand_voice_notes: profile.brand_voice_notes,
      }),
      cache: "no-store",
    });
  } catch {
    return { error: "Couldn't reach the generator service — is apps/api running?" };
  }

  if (!res.ok) return { error: "Couldn't generate more — try again." };
  const data = await res.json();
  const more = data.more;
  if (!more || !Array.isArray(more.beats) || !more.beats.length) {
    return { error: "Couldn't generate more — try again." };
  }
  return { beats: more.beats, estimated_duration_seconds: more.estimated_duration_seconds ?? null };
}

export type Suggestion = { label: string; text: string };

// Live, search-grounded suggestion chips for the dashboard's ToolBar —
// replaces a static hand-written list with "what's actually trending for
// this occupation right now" (apps/api/app/topic_suggestions.py). Returns
// null on any failure (no role set, no LLM key, search/parse failure) —
// caller falls back to its own static defaults, same as every other
// generator in this codebase never faking a result.
export async function getSuggestionsAction(role: string, lang: "zh" | "en"): Promise<Suggestion[] | null> {
  role = role.trim();
  if (!role) return null;

  const apiBase = process.env.API_BASE_URL || "http://localhost:8001";
  let res: Response;
  try {
    res = await fetch(`${apiBase}/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, lang }),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions : null;
}

export type OnboardingStatus = { jobCount: number; voiceCloned: boolean };

// Backs the home dashboard's onboarding checklist (components/
// OnboardingChecklist.tsx). Fails soft (jobCount: 0, voiceCloned: false)
// rather than throwing — this is a "nice to have" progress widget, not
// something that should ever block the dashboard from rendering if
// apps/api hiccups.
export async function getOnboardingStatusAction(): Promise<OnboardingStatus> {
  const user = await requireUser();
  const apiBase = process.env.API_BASE_URL || "http://localhost:8001";
  try {
    const res = await fetch(`${apiBase}/users/${encodeURIComponent(user.id)}/onboarding-status`, { cache: "no-store" });
    if (!res.ok) return { jobCount: 0, voiceCloned: false };
    const data = await res.json();
    return { jobCount: Number(data.job_count) || 0, voiceCloned: Boolean(data.voice_cloned) };
  } catch {
    return { jobCount: 0, voiceCloned: false };
  }
}
