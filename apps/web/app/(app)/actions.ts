"use server";

import { redirect } from "next/navigation";
import { requireUser, signOut } from "@/lib/auth";
import { addGeneration, getProfile } from "@/lib/data";
import type { GenerationKind } from "@/lib/generation-types";

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

const ENDPOINTS: Record<GenerationKind, string> = {
  video_script: "/video-scripts",
  shooting_script: "/shooting-scripts",
  content_idea: "/content-ideas",
};
const RESULT_KEYS: Record<GenerationKind, string> = {
  video_script: "script",
  shooting_script: "script",
  content_idea: "idea",
};

export type GenerateResult = { result: unknown } | { error: string };

// Called directly from the client (BrainstormTool) as a Server Function —
// not a <form action>. Orchestrates: read the caller's profile (for
// brand_voice_notes) -> call apps/api (server-to-server, no CORS needed,
// apps/api never talks to the browser directly) -> persist to history.
export async function generateContentAction(
  kind: GenerationKind,
  direction: string,
  lang: "zh" | "en"
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
      body: JSON.stringify({ direction, lang, brand_voice_notes: profile.brand_voice_notes }),
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
