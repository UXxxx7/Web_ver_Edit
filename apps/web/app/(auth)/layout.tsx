import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getLang } from "@/lib/i18n.server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();

  return (
    <div className="force-light relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <LanguageSwitcher lang={lang} className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6" />

      {/* Same texture language as /welcome — dot grid + one soft aurora
          wash — so signing in doesn't feel like a different product. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-15%] -z-10 h-[420px] w-[520px] rounded-full opacity-[0.28] blur-3xl"
        style={{ background: "conic-gradient(from 200deg, #8B5CF6, var(--primary), #22C55E, #8B5CF6)" }}
      />

      <div className="w-full max-w-sm py-10">
        <Link href="/welcome" className="mb-8 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[15px] font-bold tracking-tight">OpenMontage</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Studio
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
