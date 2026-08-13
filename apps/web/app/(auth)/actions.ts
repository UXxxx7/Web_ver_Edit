"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, signIn, signUp } from "@/lib/auth";
import { upsertProfile } from "@/lib/data";

export type AuthFormState = { error?: string };

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await signIn(email, password);
  if (result.error) return { error: result.error };
  redirect("/");
}

export async function signupAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "").trim();
  const result = await signUp(email, password);
  if (result.error) return { error: result.error };

  // Occupation chip on the signup form (optional) — save straight to the
  // profile it already feeds (see SignupForm.tsx / lib/suggestions.ts).
  if (role) {
    const user = await getCurrentUser();
    if (user) await upsertProfile(user.id, { role });
  }

  redirect("/");
}
