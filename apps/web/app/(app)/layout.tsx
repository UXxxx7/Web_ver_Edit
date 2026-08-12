import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n.server";
import type { Lang } from "@/lib/i18n";
import { signOutAction } from "./actions";

const DICT = {
  zh: { produce: "整片", brainstorm: "靈感", editor: "剪片", profile: "資料", signout: "登出" },
  en: { produce: "Produce", brainstorm: "Ideas", editor: "Editor", profile: "Profile", signout: "Sign out" },
} satisfies Record<Lang, unknown>;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, lang] = await Promise.all([getCurrentUser(), getLang()]);
  if (!user) redirect("/login"); // proxy.ts already guards this; belt-and-suspenders for direct server-render.
  const t = DICT[lang];

  return (
    <div className="force-light flex min-h-dvh flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-[8px] w-[8px] rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[15px] font-bold tracking-tight">OpenMontage</span>
          <span className="hidden rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
            Studio
          </span>
        </Link>
        <div className="flex items-center gap-1 text-[13.5px]">
          <Link href="/" className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            {t.produce}
          </Link>
          <Link href="/brainstorm" className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            {t.brainstorm}
          </Link>
          <Link href="/edit" className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            {t.editor}
          </Link>
          <Link href="/profile" className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
            {t.profile}
          </Link>
          <span className="mx-1 hidden text-muted-foreground md:inline">{user.email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t.signout}
            </button>
          </form>
          <LanguageSwitcher lang={lang} className="ml-1" />
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
