import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, type Lang } from "./i18n";

// Read once per request in a Server Component (page or layout), then pass
// the result down as a prop to Client Components — cookies() itself isn't
// importable client-side.
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return v === "en" ? "en" : DEFAULT_LANG;
}
