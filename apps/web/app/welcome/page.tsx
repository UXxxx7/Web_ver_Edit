import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getLang } from "@/lib/i18n.server";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

// generateMetadata (not a static `metadata` export) because the title/
// description need to follow the same ui_lang cookie the page body reads —
// a static export can't see cookies(). No OG/Twitter image: the previous
// one (sample-input-photo.png) turned out to be a watermarked stock photo,
// not a real licensed asset — worse to show that on social previews than
// to show none. Re-add images here once a real, unwatermarked example exists.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const title =
    lang === "zh" ? "OpenMontage Studio — 一張相，一條片" : "OpenMontage Studio — One photo. One video.";
  const description =
    lang === "zh"
      ? "上載一張相，AI 幫你搞掂劇本、配音、字幕，一鍵出招聘影片。"
      : "Upload one photo — AI writes the script, dubs the voiceover, burns in captions, and hands you a finished recruitment video.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const STEP_ICONS = [
  <path key="1" d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M4 15l4.5-4.5a1.5 1.5 0 0 1 2.1 0L14 14M14 14l1.4-1.4a1.5 1.5 0 0 1 2.1 0L20 15" />,
  <path key="2" d="M5 4.5h9l5 5V19a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 19V5A.5.5 0 0 1 5 4.5Z M14 4.5V9h4.5 M8 13h8M8 16h5" />,
  <path key="3" d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v5A1.5 1.5 0 0 1 18.5 15H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 13.5v-5Z M7.5 10v2.2M10.5 9.3v3.6M13.5 10v2.2M16.5 9.3v3.6" />,
  <path key="4" d="M4.5 11.5 19 4.8l-4.6 14.6-3.6-6.4-6.3-1.5Z M10.8 13l4-4.2" />,
];
const STEP_COLORS = ["#3E63FF", "#8B5CF6", "#22C55E", "#3E63FF"];

const DICT = {
  zh: {
    signIn: "登入",
    getStarted: "免費開始",
    badge: "為保險從業員設計 · AI 影片工具",
    headline1: "一張相，一條片。",
    headline2: "AI 幫你搞掂晒。",
    subhead: "上載一張相，就有齊劇本、廣東話配音同字幕，仲有一條完整嘅招聘影片。唔使攝影，唔使剪接，唔使開拍。",
    realOutput: "示意圖 · 實際效果因人而異",
    howItWorks: "點樣用",
    howItWorksSub: "四個步驟，每步一鍵搞掂",
    steps: [
      { title: "上載一張相", caption: "揀一張相，即刻開始" },
      { title: "AI 寫劇本", caption: "AI 幫你度好講嘅內容" },
      { title: "自動配音字幕", caption: "廣東話配音，自動加字幕" },
      { title: "一鍵出片", caption: "出片，隨時可以出post" },
    ],
    footer: "OpenMontage Studio — 為招聘打造嘅 AI 影片工具。",
    privacy: "私隱政策",
    terms: "服務條款",
  },
  en: {
    signIn: "Sign in",
    getStarted: "Get started free",
    badge: "Built for insurance recruiters · AI video tool",
    headline1: "One photo. One video.",
    headline2: "AI handles everything.",
    subhead: "Upload one photo — get a script, a Cantonese-dubbed voiceover, burned-in captions, and a finished recruitment video. No camera, no editor, no filming day.",
    realOutput: "Illustrative example",
    howItWorks: "How it works",
    howItWorksSub: "Four steps, one click each",
    steps: [
      { title: "Upload a photo", caption: "Pick one photo to start" },
      { title: "AI writes the script", caption: "AI drafts what to say" },
      { title: "Auto dub & captions", caption: "Cantonese voiceover, captions burned in" },
      { title: "Ready to post", caption: "One click, ready to publish" },
    ],
    footer: "OpenMontage Studio — an AI video tool built for recruiting.",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  },
} satisfies Record<Lang, unknown>;

export default async function WelcomePage() {
  const lang = await getLang();
  const t = DICT[lang];

  return (
    <div className="force-light flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-md sm:px-8 sm:py-3">
        <div className="flex items-center gap-2">
          <span className="h-[8px] w-[8px] rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[15px] font-bold tracking-tight">OpenMontage</span>
          <span className="hidden rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
            Studio
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher lang={lang} />
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>{t.signIn}</Link>
          <Link href="/signup" className={cn(buttonVariants({ variant: "default" }))}>{t.getStarted}</Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — copy left, real photo->video pair right, close together so
            the transformation reads at a glance. One texture layer (dot
            grid + one soft corner wash) instead of a busy multi-blob aurora. */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage: "radial-gradient(color-mix(in srgb, var(--border) 70%, transparent) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 right-[-10%] -z-10 h-[420px] w-[520px] rounded-full opacity-[0.3] blur-3xl"
            style={{ background: "conic-gradient(from 200deg, #8B5CF6, var(--primary), #22C55E, #8B5CF6)" }}
          />

          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground shadow-sm">
                {t.badge}
              </span>
              <h1 className="mx-auto mt-5 max-w-xl text-balance text-6xl font-bold leading-[1.1] tracking-tight sm:text-7xl lg:mx-0">
                {t.headline1}
                <br />
                <span className="text-primary">{t.headline2}</span>
              </h1>
              <p className="mx-auto mt-5 max-w-lg text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0">
                {t.subhead}
              </p>
              <div className="mt-7 flex items-center justify-center gap-3 lg:justify-start">
                <Link href="/signup" className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-12 px-8 text-base")}>
                  {t.getStarted}
                </Link>
                <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-8 text-base")}>
                  {t.signIn}
                </Link>
              </div>
            </div>

            {/* Photo -> video, illustrated rather than real assets — the
                previous img/video pair (sample-input-photo.png,
                sample-output-video.mp4) turned out to be a watermarked
                stock photo and a screen recording of an unrelated app, not
                real/licensed material. Same treatment as FeatureHub.tsx's
                flagship card mockup: honest about being illustrative. */}
            <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <div className="flex w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary/60 shadow-xl shadow-black/5">
                  <div className="flex aspect-[2/3] w-full items-center justify-center">
                    <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/60">
                      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M4 15l4.5-4.5a1.5 1.5 0 0 1 2.1 0L14 14M14 14l1.4-1.4a1.5 1.5 0 0 1 2.1 0L20 15 M9.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                    </svg>
                  </div>
                </div>
                <span className="rotate-90 text-3xl text-primary sm:rotate-0" aria-hidden>→</span>
                <div
                  className="relative w-full max-w-[280px] overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/5"
                  style={{ background: "linear-gradient(160deg, #1B2350, #241B4D)" }}
                >
                  <div className="flex aspect-[2/3] w-full items-center justify-center">
                    <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="9" r="3.5" />
                      <path d="M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
                    </svg>
                  </div>
                  <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded bg-white/15 text-white backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4.5h9l5 5V19a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 19V5A.5.5 0 0 1 5 4.5Z M14 4.5V9h4.5 M8 13h8M8 16h5" />
                    </svg>
                  </span>
                  <div className="absolute inset-x-3 bottom-3 rounded bg-black/60 px-2.5 py-2">
                    <div className="h-[4px] w-[75%] rounded-full bg-white/85" />
                    <div className="mt-1.5 h-[4px] w-[45%] rounded-full bg-white/85" />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {t.realOutput}
              </p>
            </div>
          </div>
        </section>

        {/* How it works — numbered steps, minimal line icons. */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-10 sm:py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">{t.howItWorks}</h2>
          <p className="mx-auto mt-2 max-w-sm text-center text-base text-muted-foreground">{t.howItWorksSub}</p>

          <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {t.steps.map((s, i) => (
              <div key={s.title} className="bg-card p-7">
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${STEP_COLORS[i]} 14%, transparent)`, color: STEP_COLORS[i] }}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {STEP_ICONS[i]}
                    </svg>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{`0${i + 1}`}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.caption}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-4 text-center text-[12.5px] text-muted-foreground sm:px-10">
        <p>{t.footer}</p>
        <p className="mt-1.5 flex items-center justify-center gap-3">
          <Link href="/privacy" className="hover:text-foreground hover:underline">{t.privacy}</Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-foreground hover:underline">{t.terms}</Link>
        </p>
      </footer>
    </div>
  );
}
