// A small always-visible preview of what a "combined_script" generation
// actually produces — sits next to BrainstormPanel so that area isn't just
// a wall of plain-Chinese copy before the user has generated anything.
// Deliberately not a fake video/photo preview (see TemplateGallery's own
// comment on why it avoids invented thumbnails) — this is an honest mockup
// of the SCRIPT+SHOT TABLE format itself, styled like a physical page so it
// reads as "here's the artifact you'll get", not as a real captured frame.
import type { Lang } from "@/lib/i18n";

const ICONS = {
  camera: "M4 8.5A2 2 0 0 1 6 6.5h1l1.5-2h7L17 6.5h1a2 2 0 0 1 2 2v9A2 2 0 0 1 18 19.5H6A2 2 0 0 1 4 17.5v-9Z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  face: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5",
  film: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4",
};

// Short lines built around a hook people actually stop scrolling for — a
// surrender-value trap most clients don't know about — with just enough
// per beat to land the point, not a one-clause fragment and not a paragraph.
const SAMPLE_BEATS: Record<Lang, { label: string; shot: string; broll: boolean; text: string; color: string }[]> = {
  zh: [
    { label: "機位一", shot: "近鏡，行緊路，冇望鏡頭", broll: false, text: "諗住而家退保？先睇多五秒，唔好一時衝動嘥咗呢筆錢。", color: "#3E63FF" },
    { label: "B-roll", shot: "特寫保單被慢慢摺埋", broll: true, text: "早幾年退保，通常淨係攞返一半保費，甚至更少，好蝕。", color: "#22C55E" },
    { label: "機位二", shot: "側身，近鏡", broll: false, text: "唔係公司特登罰你，係嗰幾年嘅保障開支，已經扣返落嚟。", color: "#8B5CF6" },
    { label: "B-roll", shot: "特寫銀行 app 或者計數機", broll: true, text: "如果真係一時缺水，其實仲有其他辦法周轉，唔使斷咗保障。", color: "#22C55E" },
    { label: "機位一", shot: "近鏡，正面望鏡頭", broll: false, text: "諗清楚先做決定，咪一時心急，到時蝕咗都唔知點解。", color: "#3E63FF" },
  ],
  en: [
    { label: "Shot 1", shot: "Close-up, walking, not facing camera", broll: false, text: "Thinking about surrendering your policy? Give it five more seconds before you throw that money away.", color: "#3E63FF" },
    { label: "B-roll", shot: "Close-up of a policy document being folded shut", broll: true, text: "Surrender it early and you usually only get back half the premiums — sometimes less. A real loss.", color: "#22C55E" },
    { label: "Shot 2", shot: "Side angle, close-up", broll: false, text: "It's not a penalty — it's the cost of the coverage you already used, deducted back out.", color: "#8B5CF6" },
    { label: "B-roll", shot: "Close-up of a banking app or calculator", broll: true, text: "If you genuinely need cash now, there are other ways to get it without breaking your coverage.", color: "#22C55E" },
    { label: "Shot 1", shot: "Close-up, facing camera", broll: false, text: "Think it through before deciding — don't act on impulse and realize the loss too late.", color: "#3E63FF" },
  ],
};

function ShowcaseIcon({ path, color, size = 13 }: { path: string; color?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color ?? "currentColor"} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

const T = {
  zh: { heading: "出嚟會係點樣？", sub: "一個方向，即刻攞埋劇本同分鏡，格式大概係咁：", footerPre: "藍/綠/紫代表唔同機位，配埋", footerFace: "望鏡頭 同", footerFilm: "B-roll 圖示，一眼睇得出邊句對邊個畫面。" },
  en: { heading: "What you'll get", sub: "One direction gets you a script + shot list, roughly in this format:", footerPre: "Blue/green/purple mark different camera setups, paired with", footerFace: "talking-head and", footerFilm: "B-roll icons — you can tell at a glance which line goes with which shot." },
} satisfies Record<Lang, { heading: string; sub: string; footerPre: string; footerFace: string; footerFilm: string }>;

export function ScriptShowcase({ lang }: { lang: Lang }) {
  const t = T[lang];
  const beats = SAMPLE_BEATS[lang];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
      <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
        <ShowcaseIcon path={ICONS.camera} /> {t.heading}
      </h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{t.sub}</p>

      {/* The "paper": fixed cream tone regardless of app theme (it's meant
          to read as a physical printed sheet, not a themed UI surface),
          slightly rotated + tape strip so it looks laid on top of the card
          rather than just another nested box. */}
      <div className="relative mt-4 mb-1">
        <div className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 rounded-[2px] bg-[#3E63FF]/18" />
        <div
          className="-rotate-1 rounded-md border border-black/10 bg-[#FFFDF6] p-3 shadow-[0_10px_24px_-10px_rgba(15,27,60,0.35)]"
          style={{
            backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 21px, rgba(15,27,60,0.06) 22px)",
          }}
        >
          <div className="flex flex-col gap-2">
            {beats.map((b, i) => (
              <div key={i} className="flex items-start gap-1.5 rounded-sm border-l-[3px] py-0.5 pl-2" style={{ borderColor: b.color }}>
                <ShowcaseIcon path={b.broll ? ICONS.film : ICONS.face} color={b.color} size={12} />
                <div className="min-w-0">
                  <div className="text-[10.5px] font-semibold leading-tight" style={{ color: b.color }}>
                    {b.label} · {b.shot}
                  </div>
                  <div className="line-clamp-2 text-[11px] leading-snug text-[#0F1B3C]/75">{b.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t.footerPre} <ShowcaseIcon path={ICONS.face} size={10} /> {t.footerFace}{" "}
        <ShowcaseIcon path={ICONS.film} size={10} /> {t.footerFilm}
      </p>
    </div>
  );
}
