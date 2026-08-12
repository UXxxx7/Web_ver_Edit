"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

export async function setLangAction(lang: Lang) {
  const store = await cookies();
  store.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
