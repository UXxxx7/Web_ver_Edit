"use client";

import { useEffect, useRef, useState } from "react";
import { generateContentAction, getSuggestionsAction, type Suggestion } from "@/app/(app)/actions";
import { FeatureHub } from "@/components/FeatureHub";
import { ResultCard } from "@/components/ResultCard";
import { TemplateGallery } from "@/components/TemplateGallery";
import { TOOL_META, type GenerationKind } from "@/lib/generation-types";
import type { Generation } from "@/lib/data";

// Matches whatsapp_mvp/lang.py's detect_lang() exactly (was missing the
// CJK Extension A range 㐀-䶿 until this was checked against the source file).
const CJK_RE = /[一-鿿㐀-䶿]/;

// Shown immediately (no loading flicker) when the profile has no role set,
// or as a fallback if the live fetch fails — never leaves the chips row
// empty. Live, occupation-specific suggestions (getSuggestionsAction)
// replace these once they arrive.
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: "客戶好評", text: "分享一個真實客戶好評 / 成功故事" },
  { label: "招聘計劃", text: "介紹公司最新招聘計劃，吸引新人加入" },
  { label: "常見問題", text: "解答返客戶最常問嘅一條問題" },
  { label: "最新優惠", text: "宣傳緊嘅優惠或者活動，一條片講清楚" },
];

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
  | { id: string; role: "bot"; status: "done"; kind: GenerationKind; result: unknown };

function historyToMessages(history: Generation[]): ChatMsg[] {
  // history arrives newest-first (lib/data.ts); reverse for oldest-first chat order.
  return [...history].reverse().flatMap((g): ChatMsg[] => [
    { id: `${g.id}-u`, role: "user", icon: TOOL_META[g.kind].icon, text: g.direction },
    { id: `${g.id}-b`, role: "bot", status: "done", kind: g.kind, result: g.result },
  ]);
}

export function Dashboard({ initialHistory, profileRole }: { initialHistory: Generation[]; profileRole: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => historyToMessages(initialHistory));
  const [pendingKinds, setPendingKinds] = useState<Set<GenerationKind>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
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
      const cached = window.localStorage.getItem(`om_suggestions:${role.trim()}`);
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // No setState here that isn't inside the .then() — everything runs after
  // the await/promise resolves, so calling this directly from the effect
  // below doesn't trip react-hooks/set-state-in-effect. Loading-indicator
  // state is a separate concern the caller opts into (see handleRefresh),
  // since the automatic background fetch doesn't need one — the cached or
  // default chips already showing are a fine placeholder while it runs.
  const fetchSuggestions = (role: string): Promise<void> => {
    if (!role.trim()) return Promise.resolve();
    return getSuggestionsAction(role, "zh").then((result) => {
      if (!result) return;
      setSuggestions(result);
      try {
        window.localStorage.setItem(`om_suggestions:${role.trim()}`, JSON.stringify(result));
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
  }, [profileRole]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3200);
  };

  async function submit(kind: GenerationKind, direction: string, clearInput: () => void) {
    direction = direction.trim();
    if (!direction) {
      showToast("Type a direction first.");
      return;
    }
    const lang: "zh" | "en" = CJK_RE.test(direction) ? "zh" : "en";
    const userMsg: ChatMsg = { id: nextId(), role: "user", icon: TOOL_META[kind].icon, text: direction };
    const botId = nextId();
    setMessages((m) => [...m, userMsg, { id: botId, role: "bot", status: "pending" }]);
    setPendingKinds((s) => new Set(s).add(kind));
    clearInput();

    const outcome = await generateContentAction(kind, direction, lang);

    setMessages((m) =>
      m.map((msg) =>
        msg.id === botId
          ? "error" in outcome
            ? { id: botId, role: "bot", status: "error", text: outcome.error }
            : { id: botId, role: "bot", status: "done", kind, result: outcome.result }
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
      <FeatureHub />
      <div id="brainstorm" className="scroll-mt-14 px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
          <BrainstormPanel
            pendingKinds={pendingKinds}
            onSubmit={submit}
            suggestions={suggestions}
            onRefresh={handleRefresh}
            refreshing={suggestionsLoading}
            value={direction}
            onValueChange={setDirection}
            inputRef={directionInputRef}
          />
          <TemplateGallery onPick={pickTemplate} compact />
        </div>
      </div>

      <main className="dash-main">
        <div className="thread">
          {messages.map((msg) => {
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
                      Searching and writing… (can take a couple of minutes if the API is slow)
                    </>
                  )}
                  {msg.status === "error" && msg.text}
                  {msg.status === "done" && (
                    <>
                      Here&apos;s what I found:
                      <ResultCard kind={msg.kind} result={msg.result as never} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className={`dash-toast${toast ? " show" : ""}`}>{toast}</div>
    </div>
  );
}

// One shared direction + one trending-topics row + 3 action buttons —
// replaces 3 near-identical ToolBar rows that all showed the same
// suggestions and just wrote the same direction to 3 different endpoints.
// A single input makes that relationship obvious instead of implicit.
const ACTION_KINDS: GenerationKind[] = ["video_script", "shooting_script", "content_idea"];

// Local, hand-drawn line icons (same treatment as FeatureHub/TemplateGallery)
// for the bits of this panel that used to be emoji.
const PANEL_ICONS = {
  refresh: "M4 9a8 8 0 0 1 14.5-4.5M20 4v5h-5 M20 15a8 8 0 0 1-14.5 4.5M4 20v-5h5",
};

function BrainstormPanel({
  pendingKinds, onSubmit, suggestions, onRefresh, refreshing, value, onValueChange, inputRef,
}: {
  pendingKinds: Set<GenerationKind>;
  onSubmit: (kind: GenerationKind, direction: string, clearInput: () => void) => void;
  suggestions: Suggestion[];
  onRefresh: () => void;
  refreshing: boolean;
  value: string;
  onValueChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const fire = (kind: GenerationKind) => onSubmit(kind, value, () => onValueChange(""));

  // Chip click fills/appends the direction so a user never has to type from
  // a blank box, but the field stays a normal input — they can still add
  // their own words before or after it. TemplateGallery replaces the value
  // outright instead (a template is a whole starting point, not an add-on).
  const pickSuggestion = (text: string) => {
    onValueChange(value.trim() ? `${value.trim()} ${text}` : text);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
      <h2 className="text-2xl font-bold text-foreground">頭腦風暴</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          畀個方向，一次過攞三樣嘢：<b className="text-foreground">劇本</b>（鏡頭前實際講嘅嘢）、
          <b className="text-foreground">拍攝清單</b>（逐個鏡頭點拍）、
          同 <b className="text-foreground">帖文idea</b>（出post用嘅文案）。有需要都會自動查最新資訊，搵唔到都會老實講。
        </p>

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
            title="換一批建議"
            className="flex shrink-0 items-center gap-1 pt-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-50"
          >
            {refreshing ? "換緊…" : (
              <>
                <ToolIcon path={PANEL_ICONS.refresh} size={12} />
                換一批
              </>
            )}
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="畀個方向…"
          spellCheck={false}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fire("video_script");
            }
          }}
          className="mt-3.5 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary"
        />

        {/* Fills the extra height once this card is stretched to match the
            template sidebar (same grid row) — real content, not a blank
            spacer, and the wrapping flex-1 still collapses to 0 on
            mobile/short content so nothing looks stretched-thin there. A
            quiet divider + plain text reads as ordinary secondary copy, not
            a boxed-up "AI assistant tip" callout. */}
        <div className="mt-4 flex-1 border-t border-border pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">小貼士</p>
          <div className="mt-2 flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
            <p>越具體嘅方向，AI寫得越貼題 — 例如加埋目標客群、想講嘅重點。</p>
            <p>打中文定英文都得，AI會跟返你打嗰種語言嚟寫。</p>
            <p>對建議唔滿意？撳「換一批」隨時攞新嘅topic。</p>
          </div>
        </div>

        {/* One primary action (video_script — also what Enter fires), two
            secondary — three identically-weighted buttons in a row is the
            same "three equal boxes" tell as the old 6-box feature hub. */}
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
                <ToolIcon path={meta.icon} /> {meta.label}
              </button>
            );
          })}
        </div>
    </div>
  );
}
