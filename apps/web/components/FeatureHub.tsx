import Link from "next/link";

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
};

function HeroBanner() {
  return (
    <div className="mb-5 rounded-2xl px-6 py-9 text-center" style={{ background: "color-mix(in srgb, #3E63FF 5%, var(--dash-card))" }}>
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
        度橋、寫劇本、出片 <span className="text-muted-foreground">—</span> 一個地方搞掂
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
        由諗內容到出片，AI陪你行齊每一步。
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
const FLAGSHIP = {
  icon: ICONS.photoToVideo, color: "#3E63FF",
  title: "相片 → 影片", body: "上載一張相，一鍵生成識講嘢嘅數碼人影片 — 唔使拍片都得。",
} as const;

const SECONDARY = [
  {
    icon: ICONS.videoEdit, color: "#8B5CF6", mockup: "trim",
    title: "AI 影片編輯", body: "上載你自己嘅片，AI幫手剪走贅字、裁做直度。",
  },
  {
    icon: ICONS.subtitles, color: "#22C55E", mockup: "lang",
    title: "字幕 / 配音翻譯", body: "加字幕，或者將條片配音翻譯做另一種語言。",
  },
] as const;

const SHORTCUTS = [
  { icon: ICONS.script, color: "#3E63FF", title: "寫劇本" },
  { icon: ICONS.shotList, color: "#8B5CF6", title: "計劃拍攝" },
  { icon: ICONS.trending, color: "#22C55E", title: "熱門靈感" },
] as const;

export function FeatureHub() {
  return (
    <div className="border-b border-border px-4 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <HeroBanner />
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
                  而家開始
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              {/* Concrete mockup instead of another abstract icon — a
                  miniature of the actual brainstorm input below, so the
                  card shows what using the product looks like rather than
                  just naming it. Static, not animated — a spinning
                  "generating" badge here was cute but read more like a demo
                  gimmick than an actual product screen. */}
              <div className="shrink-0 rounded-lg border border-dashed border-border bg-secondary/50 p-3.5 md:w-64">
                <p className="text-[11.5px] text-muted-foreground">畀個方向…</p>
                <div className="mt-2.5 h-[5px] w-[85%] rounded-full bg-border" />
                <div className="mt-1.5 h-[5px] w-[55%] rounded-full bg-border" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SECONDARY.map((item) => (
              <Link
                key={item.title}
                href="/agent"
                className="group flex flex-col items-start rounded-2xl border border-border bg-card p-5 text-left shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(15,27,60,0.16)]"
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {item.icon}
                  </svg>
                </span>
                <h3 className="mt-3.5 text-[16px] font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{item.body}</p>

                {item.mockup === "trim" ? (
                  <div className="mt-3.5 w-full">
                    <div className="flex items-center gap-[3px]">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="h-6 flex-1 rounded-[3px]"
                          style={{ background: i === 2 ? item.color : `color-mix(in srgb, ${item.color} 16%, var(--secondary))` }}
                        />
                      ))}
                    </div>
                    <span
                      className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10.5px] font-medium"
                      style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
                    >
                      剪走 0.8s 贅字
                    </span>
                  </div>
                ) : (
                  <div className="mt-3.5 flex items-center -space-x-2.5">
                    {["中", "EN", "越"].map((lang) => (
                      <span
                        key={lang}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-[11px] font-bold"
                        style={{ background: `color-mix(in srgb, ${item.color} 16%, var(--card))`, color: item.color }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                )}

                <span className="mt-3 flex items-center gap-1 text-[12.5px] font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  試吓
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
