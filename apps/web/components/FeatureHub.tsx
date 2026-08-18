import Link from "next/link";
import type { Lang } from "@/lib/i18n";

// Icons are hand-drawn inline SVG (stroke, currentColor) — deliberately not
// emoji, so the dashboard reads as a designed product surface rather than a
// generic AI-template list.
const ICONS = {
  photoToVideo: (
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M4 15l4.5-4.5a1.5 1.5 0 0 1 2.1 0L14 14M14 14l1.4-1.4a1.5 1.5 0 0 1 2.1 0L20 15 M9.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
  ),
  videoEdit: (
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3 M8 9.5l1.6 1.6L8 12.7" />
  ),
  subtitles: (
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v5A1.5 1.5 0 0 1 18.5 15H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 13.5v-5Z M7.5 10v2.2M10.5 9.3v3.6M13.5 10v2.2M16.5 9.3v3.6" />
  ),
  script: (
    <path d="M5 4.5h9l5 5V19a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 19V5A.5.5 0 0 1 5 4.5Z M14 4.5V9h4.5 M8 13h8M8 16h5" />
  ),
  shotList: (
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3 M7 5v3.2M11 5v3.2M4 8.2h9" />
  ),
  trending: (
    <path d="M4 16l5-5.5 3.5 3 6.5-7.5 M15.5 6h3.5v3.5" />
  ),
  // Same path as OnboardingChecklist.tsx's voice-clone step icon — kept
  // identical so the same feature reads as the same feature across pages.
  voice: (
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6" />
  ),
  // Small speaker glyph for the "document + sound" compound badge (聲音克隆).
  speaker: (
    <path d="M2 5.5v5h2.3L8 13.3V2.7L4.3 5.5H2Z M9.5 4.3a4.3 4.3 0 0 1 0 7.4" />
  ),
};

const T = {
  zh: {
    heroLine1: "度橋、寫劇本、出片",
    heroLine2: "一個地方搞掂",
    heroSub: "由諗內容到出片，AI陪你行齊每一步。",
    popularFeatures: "熱門功能",
    getStarted: "而家開始",
    tryIt: "試吓",
    flagshipTitle: "相片 → 影片",
    flagshipBody: "上載一張相，一鍵生成識講嘢嘅數碼人影片 — 唔使拍片都得。",
    videoEditTitle: "AI 影片編輯",
    videoEditBody: "上載你自己嘅片，AI幫手剪走贅字、裁做直度。",
    subtitleTitle: "字幕 / 配音翻譯",
    subtitleBody: "加字幕，或者將條片配音翻譯做另一種語言。",
    voiceTitle: "聲音克隆",
    voiceBody: "上載一段你把聲嘅錄音，之後啲片自動用返你把聲，唔使搵配音員。",
    shortcutScript: "寫劇本",
    shortcutShotList: "計劃拍攝",
    shortcutTrending: "熱門靈感",
    samplePhotoAlt: "範例相片",
    sampleVideoAlt: "範例生成影片，連埋標題、重點清單同按鈕",
  },
  en: {
    heroLine1: "Brainstorm, script, and produce",
    heroLine2: "all in one place",
    heroSub: "From idea to finished video — AI walks you through every step.",
    popularFeatures: "Popular features",
    getStarted: "Get started",
    tryIt: "Try it",
    flagshipTitle: "Photo → Video",
    flagshipBody: "Upload one photo, get a talking digital-human clip in one click — no filming needed.",
    videoEditTitle: "AI video editing",
    videoEditBody: "Upload your own clip — AI trims filler words and reframes it to vertical.",
    subtitleTitle: "Subtitles / dubbing",
    subtitleBody: "Add captions, or dub the video into another language.",
    voiceTitle: "Voice clone",
    voiceBody: "Upload a voice sample — future clips automatically use your voice, no voiceover artist needed.",
    shortcutScript: "Write a script",
    shortcutShotList: "Plan a shoot",
    shortcutTrending: "Trending ideas",
    samplePhotoAlt: "Sample photo",
    sampleVideoAlt: "Sample generated video, with title, key points, and a button",
  },
} satisfies Record<Lang, Record<string, string>>;

function HeroBanner({ lang }: { lang: Lang }) {
  const t = T[lang];
  return (
    <div
      className="relative mb-5 overflow-hidden rounded-2xl border border-border px-6 py-10 text-center shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]"
      style={{ background: "color-mix(in srgb, #3E63FF 5%, var(--dash-card))" }}
    >
      {/* Soft ambient glow blobs, same brand accent colors used throughout
          this file (blue/purple/green) — clipped by the card's own
          overflow-hidden + rounded corners, so they read as depth behind
          the text rather than a separate decoration. */}
      <div className="pointer-events-none absolute -left-12 -top-20 h-48 w-48 rounded-full bg-[#3E63FF] opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 -bottom-24 h-52 w-52 rounded-full bg-[#8B5CF6] opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22C55E] opacity-10 blur-3xl" />

      <h2 className="relative text-2xl font-bold tracking-tight sm:text-[28px]">
        <span className="bg-gradient-to-r from-[#3E63FF] via-[#8B5CF6] to-[#22C55E] bg-clip-text text-transparent">
          {t.heroLine1}
        </span>{" "}
        <span className="text-muted-foreground">—</span>{" "}
        <span className="text-foreground">{t.heroLine2}</span>
      </h2>
      <p className="relative mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
        {t.heroSub}
      </p>
    </div>
  );
}

// Top row: the flagship production action gets its own row and more visual
// weight; the other two share a row underneath. Three identical-width
// columns is the single most recognizable generic-AI layout tell — an
// intentional hierarchy reads as designed instead. Bottom row: 3 secondary
// shortcuts into the brainstorm panel already visible below — plain inline
// links, no card/border/shadow. Each card keeps its own accent color
// (blue/purple/green) — this is the palette from the version that was
// signed off on before the single-accent experiment.
export function FeatureHub({ lang }: { lang: Lang }) {
  const t = T[lang];
  const FLAGSHIP = { icon: ICONS.photoToVideo, color: "#3E63FF", title: t.flagshipTitle, body: t.flagshipBody };
  const SECONDARY = [
    {
      icon: ICONS.videoEdit, color: "#8B5CF6", image: "/showcase/feature-video-edit.png", compound: false,
      title: t.videoEditTitle, body: t.videoEditBody,
    },
    {
      icon: ICONS.subtitles, color: "#22C55E", image: "/showcase/feature-subtitles.png", compound: false,
      title: t.subtitleTitle, body: t.subtitleBody,
    },
    {
      icon: ICONS.voice, color: "#F59E0B", image: "/showcase/feature-voice.png", compound: true,
      title: t.voiceTitle, body: t.voiceBody,
    },
  ];
  const SHORTCUTS = [
    { icon: ICONS.script, color: "#3E63FF", title: t.shortcutScript },
    { icon: ICONS.shotList, color: "#8B5CF6", title: t.shortcutShotList },
    { icon: ICONS.trending, color: "#22C55E", title: t.shortcutTrending },
  ];
  return (
    <div className="border-b border-border px-4 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <HeroBanner lang={lang} />
        <h2 className="mb-3 text-[15px] font-bold tracking-tight text-foreground">{t.popularFeatures}</h2>
        <div className="flex flex-col gap-3">
          <div
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(15,27,60,0.16)] sm:p-9"
          >
            <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${FLAGSHIP.color} 12%, transparent)`, color: FLAGSHIP.color }}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {FLAGSHIP.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">{FLAGSHIP.title}</h3>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">{FLAGSHIP.body}</p>
                <Link
                  href="/agent"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-[13.5px] font-semibold text-background shadow-[0_4px_14px_-4px_rgba(15,27,60,0.35)] transition-transform group-hover:-translate-y-px"
                >
                  {t.getStarted}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              {/* Photo -> arrow -> video, real assets on both sides —
                  sample-input-photo.png, and a full-height still pulled
                  from sample-output-video.mp4's "理賠" chapter (public/
                  showcase/sample-output-frame.jpg): video + heading + the
                  whole numbered "how it works" list + CTA button, not just
                  the talking-head crop — that's the part that actually
                  shows "wording + supporting document," not only "the
                  photo talks." Container aspect ratio matches the crop
                  exactly (636x1160) so nothing gets cut off by object-cover. */}
              <div className="flex shrink-0 items-center gap-2">
                <div className="w-28 overflow-hidden rounded-lg border border-border shadow-sm sm:w-32">
                  <img
                    src="/showcase/sample-input-photo.png"
                    alt={t.samplePhotoAlt}
                    className="aspect-[2/3] w-full object-cover"
                  />
                </div>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
                <div className="w-20 overflow-hidden rounded-lg border border-border shadow-sm sm:w-24">
                  <img
                    src="/showcase/sample-output-frame.jpg"
                    alt={t.sampleVideoAlt}
                    className="aspect-[636/1160] w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECONDARY.map((item) => (
              <Link
                key={item.title}
                href="/agent"
                className="group flex flex-col items-start rounded-2xl border border-border bg-card p-5 text-left shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(15,27,60,0.16)]"
              >
                <span
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                  </svg>
                  {/* Document-with-a-sound-bubble composition (like the
                      reference the user shared) — a second small badge
                      overlapping the corner, built from the same hand-drawn
                      line icons rather than importing a gradient PNG that'd
                      clash with the flat-stroke icon style everywhere else. */}
                  {item.compound && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-card"
                      style={{ background: item.color, color: "white" }}
                    >
                      <svg viewBox="0 0 12 16" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        {ICONS.speaker}
                      </svg>
                    </span>
                  )}
                </span>
                <h3 className="mt-3.5 text-[16px] font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{item.body}</p>

                <div className="mx-auto mt-3.5 w-32 overflow-hidden rounded-xl shadow-[0_10px_24px_-8px_rgba(15,27,60,0.28)] sm:w-36">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full"
                  />
                </div>

                <span className="mt-3 flex items-center gap-1 text-[12.5px] font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {t.tryIt}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-5">
          {SHORTCUTS.map((item) => (
            <a
              key={item.title}
              href="#brainstorm"
              className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg
                viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={item.color} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
              >
                {item.icon}
              </svg>
              {item.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
