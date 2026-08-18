"use client";

import { useEffect, useRef, useState } from "react";
import { generateContentAction, getSuggestionsAction, type Suggestion } from "@/app/(app)/actions";
import { FeatureHub } from "@/components/FeatureHub";
import { ResultCard } from "@/components/ResultCard";
import { ScriptShowcase } from "@/components/ScriptShowcase";
import { TemplateGallery } from "@/components/TemplateGallery";
import { MOVEMENT_OPTIONS, TOOL_META, type GenerationKind, type Movement } from "@/lib/generation-types";
import type { Generation } from "@/lib/data";
import type { Lang } from "@/lib/i18n";

// Matches whatsapp_mvp/lang.py's detect_lang() exactly (was missing the
// CJK Extension A range 㐀-䶿 until this was checked against the source file).
const CJK_RE = /[一-鿿㐀-䶿]/;

// Shown immediately (no loading flicker) when the profile has no role set,
// or as a fallback if the live fetch fails — never leaves the chips row
// empty. Live, occupation-specific suggestions (getSuggestionsAction)
// replace these once they arrive.
const DEFAULT_SUGGESTIONS: Record<Lang, Suggestion[]> = {
  zh: [
    { label: "客戶好評", text: "分享一個真實客戶好評 / 成功故事" },
    { label: "招聘計劃", text: "介紹公司最新招聘計劃，吸引新人加入" },
    { label: "常見問題", text: "解答返客戶最常問嘅一條問題" },
    { label: "最新優惠", text: "宣傳緊嘅優惠或者活動，一條片講清楚" },
  ],
  en: [
    { label: "Client praise", text: "Share a real client testimonial / success story" },
    { label: "Hiring plans", text: "Introduce your company's latest hiring plan, attract new recruits" },
    { label: "FAQ", text: "Answer the question clients ask you most often" },
    { label: "Latest offer", text: "Promote a current offer or event in one clear video" },
  ],
};

const DASH_T = {
  zh: {
    typeDirection: "先打個方向。",
    searching: "搵緊資料同寫緊…（如果API慢，可能要等幾分鐘）",
    hereIsWhat: "搵到嘅嘢：",
    showMore: (n: number) => `顯示更多（仲有 ${n} 個）`,
  },
  en: {
    typeDirection: "Type a direction first.",
    searching: "Searching and writing… (can take a couple of minutes if the API is slow)",
    hereIsWhat: "Here's what I found:",
    showMore: (n: number) => `Show more (${n} left)`,
  },
} satisfies Record<Lang, { typeDirection: string; searching: string; hereIsWhat: string; showMore: (n: number) => string }>;

// TOOL_META.icon / a message's `icon` field are SVG <path d="..."> data, not
// emoji (see lib/generation-types.ts) — this wraps that path in an actual
// <svg>, matching the hand-drawn icon style used across FeatureHub /
// TemplateGallery rather than falling back to emoji glyphs.
function ToolIcon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

type ChatMsg =
  | { id: string; role: "user"; icon: string; text: string }
  | { id: string; role: "bot"; status: "pending" }
  | { id: string; role: "bot"; status: "error"; text: string }
  // movement is only ever set for combined_script (see submit()) — carried
  // alongside the result so ResultCard's "generate more" button can keep
  // extending in the same movement style without the user re-picking it.
  | { id: string; role: "bot"; status: "done"; kind: GenerationKind; result: unknown; movement?: string };

function historyToMessages(history: Generation[]): ChatMsg[] {
  // history arrives newest-first (lib/data.ts); reverse for oldest-first chat order.
  return [...history].reverse().flatMap((g): ChatMsg[] => [
    { id: `${g.id}-u`, role: "user", icon: TOOL_META[g.kind].icon, text: g.direction },
    { id: `${g.id}-b`, role: "bot", status: "done", kind: g.kind, result: g.result },
  ]);
}

// `messages` is always laid down as consecutive [user, bot] pairs (both
// historyToMessages above and submit() below only ever push/update in that
// shape) — grouping into those pairs ("turns") lets the thread be reversed
// newest-first without splitting a question from its own answer.
const TURNS_PER_PAGE = 3;
function groupIntoTurns(messages: ChatMsg[]): ChatMsg[][] {
  const turns: ChatMsg[][] = [];
  for (let i = 0; i < messages.length; i += 2) {
    turns.push(messages.slice(i, i + 2));
  }
  return turns;
}

export function Dashboard({
  initialHistory, profileRole, lang,
}: {
  initialHistory: Generation[];
  profileRole: string;
  lang: Lang;
}) {
  const t = DASH_T[lang];
  const [messages, setMessages] = useState<ChatMsg[]>(() => historyToMessages(initialHistory));
  const [pendingKinds, setPendingKinds] = useState<Set<GenerationKind>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [visibleTurns, setVisibleTurns] = useState(TURNS_PER_PAGE);
  const idCounter = useRef(0);
  const nextId = () => `m${Date.now()}-${idCounter.current++}`;

  // One shared fetch for all 3 ToolBars — they'd all want the same
  // occupation-based suggestions, no reason to call the (slow, ~20-70s
  // search+LLM) endpoint 3 times, or on every single page load. Cached in
  // localStorage per role: the lazy initializer reads the cache
  // synchronously at mount (no wait, no flicker) instead of re-fetching
  // every visit — reading in the initializer rather than setting state
  // inside the effect body also avoids react-hooks/set-state-in-effect. A
  // fresh fetch only happens the first time ever for a given role, or when
  // the user explicitly clicks "refresh".
  const readCache = (role: string): Suggestion[] | null => {
    try {
      const cached = window.localStorage.getItem(`om_suggestions:${lang}:${role.trim()}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Always starts as the static defaults — same on server and client — so
  // there's nothing for hydration to disagree about. localStorage doesn't
  // exist during SSR; reading it in a useState initializer made the
  // server's render and the client's first render produce different
  // content for the same chips, which is a real hydration-mismatch bug
  // (React warns and has to patch the DOM), not just a lint nitpick. The
  // cache is applied after mount instead, in the effect below.
  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS[lang]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // No setState here that isn't inside the .then() — everything runs after
  // the await/promise resolves, so calling this directly from the effect
  // below doesn't trip react-hooks/set-state-in-effect. Loading-indicator
  // state is a separate concern the caller opts into (see handleRefresh),
  // since the automatic background fetch doesn't need one — the cached or
  // default chips already showing are a fine placeholder while it runs.
  const fetchSuggestions = (role: string): Promise<void> => {
    if (!role.trim()) return Promise.resolve();
    return getSuggestionsAction(role, lang).then((result) => {
      if (!result) return;
      setSuggestions(result);
      try {
        window.localStorage.setItem(`om_suggestions:${lang}:${role.trim()}`, JSON.stringify(result));
      } catch {
        // localStorage unavailable (private mode, quota) — cache is a
        // nice-to-have, generation still works without it.
      }
    });
  };

  const handleRefresh = () => {
    setSuggestionsLoading(true);
    fetchSuggestions(profileRole).finally(() => setSuggestionsLoading(false));
  };

  useEffect(() => {
    if (!profileRole.trim()) return;
    const cached = readCache(profileRole);
    if (cached) {
      // Deferred a tick (not called synchronously in the effect body) —
      // both because react-hooks/set-state-in-effect flags a bare
      // setState() here, and because it keeps the very first client paint
      // matching the server's (defaults), swapping to the cached content
      // immediately after instead of during hydration itself.
      Promise.resolve().then(() => setSuggestions(cached));
      return;
    }
    fetchSuggestions(profileRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchSuggestions/readCache close over `lang` freshly each render, re-running when it changes is exactly what's wanted here
  }, [profileRole, lang]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3200);
  };

  async function submit(kind: GenerationKind, direction: string, clearInput: () => void, movement?: string) {
    direction = direction.trim();
    if (!direction) {
      showToast(t.typeDirection);
      return;
    }
    // Content language follows what the user actually typed, independent of
    // the UI's own display language (a UI in English is still perfectly
    // capable of asking for a Cantonese script, and vice versa).
    const contentLang: "zh" | "en" = CJK_RE.test(direction) ? "zh" : "en";
    const userMsg: ChatMsg = { id: nextId(), role: "user", icon: TOOL_META[kind].icon, text: direction };
    const botId = nextId();
    setMessages((m) => [...m, userMsg, { id: botId, role: "bot", status: "pending" }]);
    setPendingKinds((s) => new Set(s).add(kind));
    clearInput();

    const outcome = await generateContentAction(kind, direction, contentLang, movement);

    setMessages((m) =>
      m.map((msg) =>
        msg.id === botId
          ? "error" in outcome
            ? { id: botId, role: "bot", status: "error", text: outcome.error }
            : { id: botId, role: "bot", status: "done", kind, result: outcome.result, movement }
          : msg
      )
    );
    setPendingKinds((s) => {
      const next = new Set(s);
      next.delete(kind);
      return next;
    });
  }

  // Lifted out of BrainstormPanel so TemplateGallery can fill it too —
  // both are just different ways of arriving at the same shared direction.
  const [direction, setDirection] = useState("");
  const directionInputRef = useRef<HTMLInputElement>(null);
  const pickTemplate = (text: string) => {
    setDirection(text);
    document.getElementById("brainstorm")?.scrollIntoView({ behavior: "smooth" });
    directionInputRef.current?.focus();
  };

  return (
    <div className="dash">
      <FeatureHub lang={lang} />
      <div id="brainstorm" className="scroll-mt-14 px-4 py-6 sm:px-6">
        {/* items-start: the two columns are no longer meant to match
            height — BrainstormPanel used to stretch to the (now taller)
            sidebar and rely on the old tips block as a flex-1 spacer to
            avoid a blank gap. Both panels now just size to their own
            content instead. */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
          <BrainstormPanel
            pendingKinds={pendingKinds}
            onSubmit={submit}
            suggestions={suggestions}
            onRefresh={handleRefresh}
            refreshing={suggestionsLoading}
            value={direction}
            onValueChange={setDirection}
            inputRef={directionInputRef}
            onPickTemplate={pickTemplate}
            lang={lang}
          />
          <ScriptShowcase lang={lang} />
        </div>
      </div>

      <main className="dash-main">
        <div className="thread">
          {(() => {
            // Newest turn first — reversed at the turn level (not the flat
            // message level) so a question always stays directly above its
            // own answer instead of the pair getting split apart.
            const reversedTurns = [...groupIntoTurns(messages)].reverse();
            const shownTurns = reversedTurns.slice(0, visibleTurns);
            return (
              <>
                {shownTurns.map((turn, turnIndex) => {
                  const userMsg = turn.find((m) => m.role === "user");
                  return (
                    <div key={turn[0]?.id ?? "empty"} className="flex flex-col gap-3">
                      {turn.map((msg) => {
                        if (msg.role === "user") {
                          return (
                            <div key={msg.id} className="msg from-user">
                              <div className="bubble flex items-center gap-1.5">
                                <ToolIcon path={msg.icon} />
                                {msg.text}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={msg.id} className="msg from-bot">
                            <div className="bubble">
                              {msg.status === "pending" && (
                                <>
                                  <span className="dash-spinner" />
                                  {t.searching}
                                </>
                              )}
                              {msg.status === "error" && msg.text}
                              {msg.status === "done" && (
                                <>
                                  {t.hereIsWhat}
                                  <ResultCard
                                    kind={msg.kind}
                                    result={msg.result as never}
                                    direction={userMsg?.role === "user" ? userMsg.text : ""}
                                    movement={msg.movement}
                                    defaultCollapsed={turnIndex !== 0}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {reversedTurns.length > shownTurns.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleTurns((n) => n + TURNS_PER_PAGE)}
                    className="mx-auto rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/50"
                  >
                    {t.showMore(reversedTurns.length - shownTurns.length)}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </main>

      <div className={`dash-toast${toast ? " show" : ""}`}>{toast}</div>
    </div>
  );
}

// One shared direction + one trending-topics row + 2 action buttons —
// replaces 3 near-identical ToolBar rows that all showed the same
// suggestions and just wrote the same direction to 3 different endpoints.
// A single input makes that relationship obvious instead of implicit.
// video_script/shooting_script used to be two separate actions/buttons;
// combined_script replaced both with one aligned script+shot table (see
// apps/api/app/combined_script.py's header for why — a professionally
// produced reference the team was given uses exactly that combined format,
// not two documents a user has to mentally line up themselves).
const ACTION_KINDS: GenerationKind[] = ["combined_script", "content_idea"];

// Local, hand-drawn line icons (same treatment as FeatureHub/TemplateGallery)
// for the bits of this panel that used to be emoji.
// Same blue/purple/green rotation as FeatureHub's icon badges — the plain
// black-outline icons here (no color, no badge) were the flattest part of
// the panel next to ScriptShowcase's colored highlight bars.
const PANEL_FEATURE_COLORS = ["#3E63FF", "#8B5CF6", "#22C55E"];

const PANEL_ICONS = {
  refresh: "M4 9a8 8 0 0 1 14.5-4.5M20 4v5h-5 M20 15a8 8 0 0 1-14.5 4.5M4 20v-5h5",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  bulb: "M9 18h6 M9.5 21h5 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.3 2.4 3.6 5.5 3.6 9s-1.3 6.6-3.6 9c-2.3-2.4-3.6-5.5-3.6-9s1.3-6.6 3.6-9Z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M16.2 16.2 21 21",
};

const PANEL_T = {
  zh: {
    heading: "頭腦風暴",
    descPre: "畀個方向，一次過攞埋",
    descScript: "劇本連分鏡",
    descMid: "（邊個鏡頭講咩，同埋望鏡頭/B-roll 點配合）、同",
    descIdea: "帖文idea",
    descPost: "（出post用嘅文案）。",
    features: [
      { icon: PANEL_ICONS.target, label: "越具體越好", body: "加埋目標客群、想講嘅重點，AI寫得會更貼題。" },
      { icon: PANEL_ICONS.globe, label: "中英文都得", body: "打中文定英文都得，AI會跟返你打嗰種語言嚟寫。" },
      { icon: PANEL_ICONS.search, label: "自動查資料", body: "有需要都會自動查最新資訊，搵唔到都會老實講。" },
    ],
    directionPh: "畀個方向…",
    movementLabel: "拍攝郁動：",
    refreshTitle: "換一批建議",
    refreshing: "換緊…",
    refresh: "換一批",
  },
  en: {
    heading: "Brainstorm",
    descPre: "Give a direction, get both a",
    descScript: "script + shot list",
    descMid: "(who talks to camera when, how B-roll fits in) and a",
    descIdea: "post caption idea",
    descPost: "in one go.",
    features: [
      { icon: PANEL_ICONS.target, label: "Be specific", body: "Add your target audience and key points — the AI writes closer to the mark." },
      { icon: PANEL_ICONS.globe, label: "Chinese or English", body: "Type in either language — the AI writes back in whichever you used." },
      { icon: PANEL_ICONS.search, label: "Auto-researched", body: "Looks up current info when useful, and says so honestly when it can't find any." },
    ],
    directionPh: "Give a direction…",
    movementLabel: "Camera movement:",
    refreshTitle: "Refresh suggestions",
    refreshing: "Refreshing…",
    refresh: "Refresh",
  },
} satisfies Record<Lang, {
  heading: string; descPre: string; descScript: string; descMid: string; descIdea: string; descPost: string;
  features: readonly { icon: string; label: string; body: string }[];
  directionPh: string; movementLabel: string; refreshTitle: string; refreshing: string; refresh: string;
}>;

function BrainstormPanel({
  pendingKinds, onSubmit, suggestions, onRefresh, refreshing, value, onValueChange, inputRef, onPickTemplate, lang,
}: {
  pendingKinds: Set<GenerationKind>;
  onSubmit: (kind: GenerationKind, direction: string, clearInput: () => void, movement?: string) => void;
  suggestions: Suggestion[];
  onRefresh: () => void;
  refreshing: boolean;
  value: string;
  onValueChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPickTemplate: (text: string) => void;
  lang: Lang;
}) {
  const t = PANEL_T[lang];
  // Only combined_script reads this — content_idea ignores it (the action
  // itself passes it through regardless, apps/api's generateContentAction
  // signature just accepts an optional extra param).
  const [movement, setMovement] = useState<Movement>("walk");
  const fire = (kind: GenerationKind) => onSubmit(kind, value, () => onValueChange(""), movement);

  // Chip click fills/appends the direction so a user never has to type from
  // a blank box, but the field stays a normal input — they can still add
  // their own words before or after it. TemplateGallery replaces the value
  // outright instead (a template is a whole starting point, not an add-on).
  const pickSuggestion = (text: string) => {
    onValueChange(value.trim() ? `${value.trim()} ${text}` : text);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "color-mix(in srgb, #F59E0B 14%, transparent)", color: "#F59E0B" }}
        >
          <ToolIcon path={PANEL_ICONS.bulb} size={18} />
        </span>
        {t.heading}
      </h2>
        <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">
          {t.descPre} <b className="text-foreground">{t.descScript}</b>{t.descMid}
          {" "}<b className="text-foreground">{t.descIdea}</b>{t.descPost}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {t.features.map((f, i) => {
            const color = PANEL_FEATURE_COLORS[i];
            return (
              <div
                key={f.label}
                className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5 transition-colors hover:border-primary/40"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                >
                  <ToolIcon path={f.icon} size={14} />
                </span>
                <span className="text-[12px] font-semibold text-foreground">{f.label}</span>
                <span className="text-[10.5px] leading-snug text-muted-foreground">{f.body}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <TemplateGallery variant="row" onPick={onPickTemplate} lang={lang} />
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pickSuggestion(s.text)}
                className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title={t.refreshTitle}
            className="flex shrink-0 items-center gap-1 pt-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-50"
          >
            {refreshing ? t.refreshing : (
              <>
                <ToolIcon path={PANEL_ICONS.refresh} size={12} />
                {t.refresh}
              </>
            )}
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={t.directionPh}
          spellCheck={false}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fire("combined_script");
            }
          }}
          className="mt-3.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary"
        />

        {/* Only matters for combined_script (content_idea ignores it), but
            shown regardless — deciding this before firing beats discovering
            afterwards the shot list assumed the wrong amount of movement. */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">{t.movementLabel}</span>
          <div className="flex gap-1">
            {MOVEMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMovement(opt.value)}
                className={
                  movement === opt.value
                    ? "rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground"
                    : "rounded-md border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                }
              >
                {opt.label[lang]}
              </button>
            ))}
          </div>
        </div>

        {/* Primary action (combined_script — also what Enter fires) plus
            one secondary — matches the button-hierarchy fix applied
            elsewhere (equally-weighted buttons in a row was the same
            "three equal boxes" tell as the old 6-box feature hub). */}
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTION_KINDS.map((kind, i) => {
            const meta = TOOL_META[kind];
            const primary = i === 0;
            return (
              <button
                key={kind}
                onClick={() => fire(kind)}
                disabled={pendingKinds.has(kind)}
                className={
                  primary
                    ? "flex flex-1 min-w-[130px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-transform enabled:hover:-translate-y-px disabled:cursor-default disabled:opacity-60"
                    : "flex flex-1 min-w-[130px] items-center justify-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[13px] font-semibold text-foreground transition-colors enabled:hover:border-primary/50 disabled:cursor-default disabled:opacity-60"
                }
              >
                <ToolIcon path={meta.icon} /> {meta.label[lang]}
              </button>
            );
          })}
        </div>
    </div>
  );
}
