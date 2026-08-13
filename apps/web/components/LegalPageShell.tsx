import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Lang } from "@/lib/i18n";
import type { LegalDoc } from "@/lib/legal-content";

const BACK = { zh: "返回", en: "Back" } satisfies Record<Lang, string>;

// Shared chrome for /privacy and /terms — same header pattern as /welcome
// (logo + language switcher), plus a simple heading/section renderer for
// the plain-data LegalDoc shape in lib/legal-content.ts. Public pages, no
// auth required — someone should be able to read these before signing up.
export function LegalPageShell({ doc, lang }: { doc: LegalDoc; lang: Lang }) {
  return (
    <div className="force-light flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-md sm:px-8 sm:py-3">
        <Link href="/welcome" className="flex items-center gap-2">
          <span className="h-[8px] w-[8px] rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[15px] font-bold tracking-tight">OpenMontage</span>
          <span className="hidden rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
            Studio
          </span>
        </Link>
        <LanguageSwitcher lang={lang} />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <Link href="/welcome" className="text-sm text-muted-foreground hover:text-foreground">
          ← {BACK[lang]}
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="mt-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">{doc.updated}</p>
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{doc.intro}</p>

        <div className="mt-10 flex flex-col gap-8">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold tracking-tight">{s.heading}</h2>
              <div className="mt-2 flex flex-col gap-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[14.5px] leading-relaxed text-muted-foreground">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-4 py-4 text-center font-mono text-[11.5px] uppercase tracking-wide text-muted-foreground sm:px-10">
        OpenMontage Studio
      </footer>
    </div>
  );
}
