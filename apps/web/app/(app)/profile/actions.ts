"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { upsertProfile } from "@/lib/data";

export type ProfileFormState = { error?: string; saved?: boolean };

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await requireUser();
  const preferred_lang = formData.get("preferred_lang") === "en" ? "en" : "zh";

  await upsertProfile(user.id, {
    display_name: String(formData.get("display_name") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim(),
    preferred_lang,
    brand_voice_notes: String(formData.get("brand_voice_notes") ?? "").trim(),
  });

  revalidatePath("/profile");
  revalidatePath("/");
  return { saved: true };
}

export type AvatarResult = { ok: true } | { ok: false; error: string };

// There's no real object storage wired up yet (see lib/community.ts's own
// header on the same gap) — the client resizes/compresses the photo to a
// small square JPEG (AvatarUpload.tsx, canvas-based) and sends it as a data
// URL, stored directly in profiles.avatar_url (text column, works for both
// the JSON mock store and real Postgres). The cap here is generous headroom
// over what that resize actually produces (usually 15-40KB) — just enough
// to stop something huge slipping through if the client-side resize is ever
// bypassed, not a real quota.
const MAX_AVATAR_DATA_URL_LENGTH = 2_000_000;

export async function updateAvatarAction(dataUrl: string): Promise<AvatarResult> {
  const user = await requireUser();
  if (!dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Not a valid image." };
  }
  if (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
    return { ok: false, error: "Image too large — try a smaller photo." };
  }

  await upsertProfile(user.id, { avatar_url: dataUrl });
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}
