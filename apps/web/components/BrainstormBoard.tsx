"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { generateContentAction } from "@/app/(app)/actions";
import { ResultCard } from "@/components/ResultCard";
import { TOOL_ICONS, TOOL_TEXT, type GenerationKind } from "@/lib/generation-types";
import { getSuggestions } from "@/lib/suggestions";
import type { Generation } from "@/lib/data";
import type { Lang } from "@/lib/i18n";

// Matches whatsapp_mvp/lang.py's detect_lang() exactly (was missing the
// CJK Extension A range 㐀-䶿 until this was checked against the source file).
const CJK_RE = /[一-鿿㐀-䶿]/;

const DICT = {
  zh: {
    hookKicker: "唔知講咩好？",
    hookHeadline: "想整片，但唔知講咩好？",
    hookBody: "落面3個工具，幫你由一個方向，變出劇本、拍攝清單、同帖文idea。",
    instructionsTitle: "點用？",
    steps: [
      "揀個建議，或者自己打個方向",
      "撳返啱嘅掣：寫劇本 / 計劃拍攝 / 攞idea",
      "攞到劇本之後，去返下面嘅製作流程，貼落去就一鍵出片",
    ],
    cta: "去整片 →",
    typeFirst: "先打個方向。",
    empty: "你嘅結果會喺呢度出現。",
    pending: "搜尋緊同寫緊…（如果API慢可能要幾分鐘）",
    found: "搵到啦：",
  },
  en: {
    hookKicker: "Don't know what to say?",
    hookHeadline: "Want to make a video, but don't know what to say?",
    hookBody: "The 3 tools below turn a direction into a script, shot list, or post idea.",
    instructionsTitle: "How to use",
    steps: [
      "Pick a suggestion, or type your own direction",
      "Hit the matching button: Write script / Plan shots / Get idea",
      "Got something you like? Head to the production flow below and paste it in to produce",
    ],
    cta: "Go produce →",
    typeFirst: "Type a direction first.",
    empty: "Your results will appear here.",
    pending: "Searching and writing… (can take a couple of minutes if the API is slow)",
    found: "Here's what I found:",
  },
} satisfies Record<Lang, unknown>;

type ChatMsg =
  | { id: string; role: "user"; icon: string; text: string }
  | { id: string; role: "bot"; status: "pending" }
  | { id: string; role: "bot"; status: "error"; text: string }
  | { id: string; role: "bot"; status: "done"; kind: GenerationKind; result: unknown };

function historyToMessages(history: Generation[]): ChatMsg[] {
  // history arrives newest-first (lib/data.ts); reverse for oldest-first chat order.
  return [...history].reverse().flatMap((g): ChatMsg[] => [
    { id: `${g.id}-u`, role: "user", icon: TOOL_ICONS[g.kind], text: g.direction },
    { id: `${g.id}-b`, role: "bot", status: "done", kind: g.kind, result: g.result },
  ]);
}

export function BrainstormBoard({
  initialHistory,
  profileRole,
  lang: uiLang,
}: {
  initialHistory: Generation[];
  profileRole: string;
  lang: Lang;
}) {
  const t = DICT[uiLang];
  const [messages, setMessages] = useState<ChatMsg[]>(() => historyToMessages(initialHistory));
  const [pendingKinds, setPendingKinds] = useState<Set<GenerationKind>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const idCounter = useRef(0);
  const nextId = () => `m${Date.now()}-${idCounter.current++}`;

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3200);
  };

  async function submit(kind: GenerationKind, direction: string, clearInput: () => void) {
    direction = direction.trim();
    if (!direction) {
      showToast(t.typeFirst);
      return;
    }
    // Content generation language is detected from what the user typed, not
    // the UI language — someone can browse in English and still write a
    // Cantonese direction (or vice versa) and get matching output.
    const genLang: "zh" | "en" = CJK_RE.test(direction) ? "zh" : "en";
    const userMsg: ChatMsg = { id: nextId(), role: "user", icon: TOOL_ICONS[kind], text: direction };
    const botId = nextId();
    setMessages((m) => [...m, userMsg, { id: botId, role: "bot", status: "pending" }]);
    setPendingKinds((s) => new Set(s).add(kind));
    clearInput();

    const outcome = await generateContentAction(kind, direction, genLang);

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <p className="font-mono text-[11.5px] font-semibold uppercase tracking-wide text-primary">{t.hookKicker}</p>
        <h1 className="mx-auto mt-3 max-w-lg text-balance text-2xl font-bold tracking-tight sm:text-3xl">{t.hookHeadline}</h1>
        <p className="mx-auto mt-2 max-w-md text-balance text-sm text-muted-foreground">{t.hookBody}</p>
      </div>

      <div className="dash overflow-hidden rounded-2xl border border-border">
        <ToolBar kind="video_script" pending={pendingKinds.has("video_script")} onSubmit={submit} profileRole={profileRole} lang={uiLang} primary />
        <ToolBar kind="shooting_script" pending={pendingKinds.has("shooting_script")} onSubmit={submit} profileRole={profileRole} lang={uiLang} />
        <ToolBar kind="content_idea" pending={pendingKinds.has("content_idea")} onSubmit={submit} profileRole={profileRole} lang={uiLang} />

        <div className="border-t border-border bg-secondary/40 px-5 py-4">
          <h2 className="text-[13px] font-semibold">{t.instructionsTitle}</h2>
          <ol className="mt-2 flex flex-col gap-1">
            {t.steps.map((s, i) => (
              <li key={s} className="flex gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <span className="font-mono text-primary">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
          <Link href="/" className="mt-3 inline-block text-[12.5px] font-semibold text-primary hover:underline">
            {t.cta}
          </Link>
        </div>

        <main className="dash-main">
          <div className="thread">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>{t.empty}</p>
              </div>
            )}
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="msg from-user">
                    <div className="bubble">
                      {msg.icon} {msg.text}
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
                        {t.pending}
                      </>
                    )}
                    {msg.status === "error" && msg.text}
                    {msg.status === "done" && (
                      <>
                        {t.found}
                        <ResultCard kind={msg.kind} result={msg.result as never} lang={uiLang} />
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
    </div>
  );
}

function ToolBar({
  kind, pending, onSubmit, profileRole, lang, primary,
}: {
  kind: GenerationKind;
  pending: boolean;
  onSubmit: (kind: GenerationKind, direction: string, clearInput: () => void) => void;
  profileRole: string;
  lang: Lang;
  primary?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = { icon: TOOL_ICONS[kind], ...TOOL_TEXT[lang][kind] };
  const suggestions = getSuggestions(profileRole);

  const fire = () => onSubmit(kind, value, () => setValue(""));

  // Chip click fills/appends the direction so a user never has to type from
  // a blank box, but the field stays a normal input — they can still add
  // their own words before or after it.
  const pickSuggestion = (text: string) => {
    setValue((v) => (v.trim() ? `${v.trim()} ${text}` : text));
    inputRef.current?.focus();
  };

  return (
    <div className={`gen-bar-wrap${primary ? " primary" : ""}`}>
      <div className="gen-bar">
        <span className="gen-bar-icon">{meta.icon}</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={meta.placeholder}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fire();
            }
          }}
        />
        <button onClick={fire} disabled={pending}>
          {meta.label}
        </button>
      </div>
      <div className="gen-suggestions">
        {suggestions.map((s) => (
          <button key={s.label} type="button" className="gen-chip" onClick={() => pickSuggestion(s.text)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
