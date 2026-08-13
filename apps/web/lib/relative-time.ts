// Small shared "X ago" formatter — extracted out of RecentWork.tsx when
// CommunityFeed.tsx needed the exact same thing, rather than a second
// copy drifting out of sync with it.
import type { Lang } from "./i18n";

const T = {
  zh: { justNow: "啱啱", minAgo: (n: number) => `${n} 分鐘前`, hrAgo: (n: number) => `${n} 小時前`, dayAgo: (n: number) => `${n} 日前` },
  en: { justNow: "Just now", minAgo: (n: number) => `${n}m ago`, hrAgo: (n: number) => `${n}h ago`, dayAgo: (n: number) => `${n}d ago` },
} satisfies Record<Lang, { justNow: string; minAgo: (n: number) => string; hrAgo: (n: number) => string; dayAgo: (n: number) => string }>;

export function relativeTime(iso: string | null, lang: Lang): string {
  if (!iso) return "";
  const t = T[lang];
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.hrAgo(hrs);
  return t.dayAgo(Math.floor(hrs / 24));
}
