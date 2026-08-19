// Visual template gallery — the CapCut-style "pick a proven format" entry
// point (see capcut.com/templates), adapted for this product: templates
// here are about the video's PURPOSE/FORMAT (self-intro, testimonial,
// FAQ...), complementary to the live trending-topic chips in
// BrainstormPanel which are about the TOPIC. No fake preview thumbnails —
// we don't have real rendered examples per template, and showing invented
// video previews would be misleading; icon + description is honest about
// what this actually is (a starting prompt, not a finished clip).
import type { Lang } from "@/lib/i18n";

const ICONS = {
  intro: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 20c1-4 4-6 7-6s6 2 7 6" />,
  testimonial: <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v5A1.5 1.5 0 0 1 18.5 15H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 13.5v-5Z M8.5 11h7" />,
  recruit: <path d="M3 11l18-7-7 18-3-7-8-4Z" />,
  faq: <path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7v.5 M12 17.5h.01 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
  festive: <path d="M12 3v3M5 8l2 2M19 8l-2 2 M4 20h16l-2-8-3 3-3-6-3 6-3-3-2 8Z" />,
  trend: <path d="M4 16l5-5.5 3.5 3 6.5-7.5 M15.5 6h3.5v3.5" />,
};

type Template = { icon: React.ReactNode; color: string; title: string; tag: string; body: string; prompt: string };

// prompt is what actually fills the direction box, which then determines
// the generated CONTENT's language (see Dashboard.tsx's contentLang
// auto-detect) — kept in the same language as the UI so an English-UI user
// picking a template gets an English prompt -> English generated script,
// not a Cantonese one that clashes with the rest of their screen.
const TEMPLATES: Record<Lang, Template[]> = {
  zh: [
    {
      icon: ICONS.intro, color: "#3E63FF",
      title: "自我介紹", tag: "破冰",
      body: "你係邊個、做緊咩、點解啱做呢行",
      prompt: "拍一條自我介紹片：講吓我係邊個、依家做緊咩、點解揀咗做呢行，等新客戶可以認識吓我。",
    },
    {
      icon: ICONS.testimonial, color: "#22C55E",
      title: "客戶好評", tag: "建立信任",
      body: "分享一個真實成功故事",
      prompt: "分享一個真實客戶好評 / 成功故事，講吓佢哋點解揀我、服務過程點樣、結果點樣。",
    },
    {
      icon: ICONS.recruit, color: "#8B5CF6",
      title: "招聘計劃", tag: "搵人",
      body: "吸引新人加入你哋公司",
      prompt: "介紹公司最新招聘計劃，包括入行要求、培訓支援、同埋點解而家係入行嘅好時機，吸引新人加入。",
    },
    {
      icon: ICONS.faq, color: "#3E63FF",
      title: "常見問答", tag: "教育",
      body: "解答客戶最常問嘅一條問題",
      prompt: "解答返客戶最常問嘅一條問題，用簡單直接嘅方式講清楚，唔好用太多術語。",
    },
    {
      icon: ICONS.festive, color: "#22C55E",
      title: "節日祝福", tag: "維繫關係",
      body: "藉節日問候，順帶提吓服務",
      prompt: "藉住嚟緊嘅節日，send一個溫馨祝福畀客戶，順便自然咁提吓自己嘅服務，唔好太sales feel。",
    },
    {
      icon: ICONS.trend, color: "#8B5CF6",
      title: "行業趨勢", tag: "建立權威",
      body: "用最新新聞教人點應對",
      prompt: "用返最近行業入面嘅新聞或者趨勢，教吓觀眾呢件事點樣影響佢哋，同埋應該點應對。",
    },
  ],
  en: [
    {
      icon: ICONS.intro, color: "#3E63FF",
      title: "Self-intro", tag: "Icebreaker",
      body: "Who you are, what you do, why you're right for it",
      prompt: "Film a self-introduction video: who I am, what I do now, why I chose this line of work — so new clients get to know me.",
    },
    {
      icon: ICONS.testimonial, color: "#22C55E",
      title: "Client praise", tag: "Build trust",
      body: "Share a real success story",
      prompt: "Share a real client testimonial / success story — why they chose me, what the process was like, and the outcome.",
    },
    {
      icon: ICONS.recruit, color: "#8B5CF6",
      title: "Hiring plan", tag: "Recruiting",
      body: "Attract new people to join your company",
      prompt: "Introduce your company's latest hiring plan — entry requirements, training support, and why now is a good time to join.",
    },
    {
      icon: ICONS.faq, color: "#3E63FF",
      title: "FAQ", tag: "Education",
      body: "Answer clients' most common question",
      prompt: "Answer the question clients ask you most often — explain it simply and directly, without too much jargon.",
    },
    {
      icon: ICONS.festive, color: "#22C55E",
      title: "Seasonal greeting", tag: "Stay in touch",
      body: "A holiday greeting that naturally mentions your service",
      prompt: "Send a warm holiday greeting to clients tied to an upcoming occasion, and naturally mention your service without being too salesy.",
    },
    {
      icon: ICONS.trend, color: "#8B5CF6",
      title: "Industry trend", tag: "Build authority",
      body: "Use recent news to coach viewers",
      prompt: "Use a recent industry news story or trend to teach viewers how it affects them and what they should do about it.",
    },
  ],
};

const T = {
  zh: { heading: "範本靈感", compactSub: "揀一個格式，填好個方向。", fullSub: "唔知點入手？揀一個常見嘅片格式，會幫你填好個方向，可以自己再改。" },
  en: { heading: "Template inspiration", compactSub: "Pick a format to fill in your direction.", fullSub: "Not sure where to start? Pick a common video format — it fills in a direction for you, editable after." },
} satisfies Record<Lang, { heading: string; compactSub: string; fullSub: string }>;

export function TemplateGallery({
  onPick, variant = "cards", lang,
}: {
  onPick: (text: string) => void;
  variant?: "cards" | "compact" | "row";
  lang: Lang;
}) {
  const compact = variant === "compact";
  const t = T[lang];
  const templates = TEMPLATES[lang];

  // "row" sits inline inside BrainstormPanel's own card (see Dashboard.tsx)
  // rather than as its own bordered panel, so it needs no card chrome or
  // description line — just the pick-a-format chips, horizontally.
  if (variant === "row") {
    return (
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {templates.map((tpl) => (
          <button
            key={tpl.title}
            type="button"
            onClick={() => onPick(tpl.prompt)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:border-primary/50"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={tpl.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              {tpl.icon}
            </svg>
            {tpl.title}
          </button>
        ))}
      </div>
    );
  }

  const heading = (
    <>
      <h2 className="text-[13px] font-semibold text-foreground">{t.heading}</h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {compact ? t.compactSub : t.fullSub}
      </p>
    </>
  );

  const cards = templates.map((tpl) =>
    compact ? (
      <button
        key={tpl.title}
        type="button"
        onClick={() => onPick(tpl.prompt)}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-secondary/60"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={tpl.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          {tpl.icon}
        </svg>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold text-foreground">{tpl.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{tpl.body}</span>
        </span>
      </button>
    ) : (
      <button
        key={tpl.title}
        type="button"
        onClick={() => onPick(tpl.prompt)}
        className="flex flex-col items-start rounded-xl border border-border bg-card p-3.5 text-left shadow-sm transition-colors hover:border-primary/50"
      >
        <div className="flex w-full items-center justify-between">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: `color-mix(in srgb, ${tpl.color} 14%, transparent)`, color: tpl.color }}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {tpl.icon}
            </svg>
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
            {tpl.tag}
          </span>
        </div>
        <h3 className="mt-2 text-[13px] font-semibold text-foreground">{tpl.title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{tpl.body}</p>
      </button>
    )
  );

  if (compact) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
        {heading}
        <div className="mt-2 flex flex-col divide-y divide-border">{cards}</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {heading}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{cards}</div>
      </div>
    </div>
  );
}
