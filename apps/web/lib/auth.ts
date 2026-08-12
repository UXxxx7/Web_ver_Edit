// Unified auth interface — the ONLY module the rest of the app should
// import for auth. Dispatches to real Supabase Auth once
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set; until then, runs a local
// mock (lib/store.ts + lib/session.ts) so signup -> login -> dashboard can
// be built and demoed with zero cloud credentials (2026-08-12 direction).
// Callers (Server Actions, Server Components) never need to know which
// mode is active.
import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { COOKIE_NAME, MAX_AGE_S, createSessionToken, verifySessionToken } from "./session";
import { createUser, findUserByEmail, findUserById } from "./store";
import { createClient as createSupabaseServerClient } from "./supabase/server";

export type CurrentUser = { id: string; email: string };
export type AuthResult = { error: string } | { error?: undefined };

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;
  const user = await findUserById(session.uid);
  if (!user) return null;
  return { id: user.id, email: user.email };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  email = email.trim().toLowerCase();
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: error.message } : {};
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(email, passwordHash);
    await setMockSessionCookie(user.id);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sign up failed." };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  email = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }

  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  await setMockSessionCookie(user.id);
  return {};
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return;
  }
  (await cookies()).delete(COOKIE_NAME);
}

async function setMockSessionCookie(uid: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, createSessionToken(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}
