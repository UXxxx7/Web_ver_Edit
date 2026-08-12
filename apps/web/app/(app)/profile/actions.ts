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
