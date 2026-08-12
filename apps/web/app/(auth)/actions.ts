"use server";

import { redirect } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";

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
  const result = await signUp(email, password);
  if (result.error) return { error: result.error };
  redirect("/");
}
