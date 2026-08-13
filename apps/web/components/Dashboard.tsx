"use client";

import { useRef, useState } from "react";
import { generateContentAction } from "@/app/(app)/actions";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ResultCard } from "@/components/ResultCard";
import { ScenarioGallery } from "@/components/ScenarioGallery";
import { TOOL_META, type GenerationKind } from "@/lib/generation-types";
import type { Generation } from "@/lib/data";
import type { Lang } from "@/lib/i18n";

// Matches whatsapp_mvp/lang.py's detect_lang() exactly (was missing the
// CJK Extension A range 㐀-䶿 until this was checked against the source file).
const CJK_RE = /[一-鿿㐀-䶿]/;

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

export function Dashboard({
  initialHistory, role, profileComplete, uiLang,
}: {
  initialHistory: Generation[];
  role: string; // profile.role — see lib/scenario-templates.ts for how this personalizes the gallery below
  profileComplete: boolean; // display_name && role both set — feeds OnboardingChecklist's step 1
  // Site display language (ui_lang cookie) — only the scenario gallery's own
  // card labels/copy. Named uiLang, not lang, to avoid shadowing submit()'s
  // own `lang` below (that one's per-message, auto-detected from the
  // direction text's script — a different concept, deliberately unrelated).
  uiLang: Lang;
}) {
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

  // Scenario cards call submit() with a no-op clearInput — there's no
  // associated <input> to clear, they fire a fully pre-written direction
  // straight away (matches the reference "Create Now" pattern).
  const fireScenario = (kind: GenerationKind, direction: string) => submit(kind, direction, () => {});

  return (
    <div className="dash">
      <OnboardingChecklist
        lang={uiLang}
        profileComplete={profileComplete}
        // Live `messages` state, not the initialHistory prop — so a
        // generation fired in this same session (e.g. from a scenario
        // card) checks step 2 off immediately, not just after a reload.
        hasGeneration={messages.some((m) => m.role === "bot" && m.status === "done")}
      />
      <ScenarioGallery role={role} lang={uiLang} pendingKinds={pendingKinds} onFire={fireScenario} />
      <ToolBar kind="video_script" pending={pendingKinds.has("video_script")} onSubmit={submit} primary />
      <ToolBar kind="shooting_script" pending={pendingKinds.has("shooting_script")} onSubmit={submit} />
      <ToolBar kind="content_idea" pending={pendingKinds.has("content_idea")} onSubmit={submit} />

      <main className="dash-main">
        <div className="thread">
          {messages.length === 0 && (
            <div className="empty-state">
              <p className="kicker">Content brainstorm — no filming, no editing</p>
              <h2>Give a direction, get three kinds of content.</h2>
              <p>
                📝 A <b>video script</b> — the actual words to say on camera. 🎬 A <b>shot list</b> — how to
                film it, angle by angle. 💡 A <b>sample post</b> — the caption to publish it with. All three
                search for current information when it&apos;s relevant, and tell you honestly when they didn&apos;t.
              </p>
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

function ToolBar({
  kind, pending, onSubmit, primary,
}: {
  kind: GenerationKind;
  pending: boolean;
  onSubmit: (kind: GenerationKind, direction: string, clearInput: () => void) => void;
  primary?: boolean;
}) {
  const [value, setValue] = useState("");
  const meta = TOOL_META[kind];

  const fire = () => onSubmit(kind, value, () => setValue(""));

  return (
    <div className={`gen-bar${primary ? " primary" : ""}`}>
      <span className="gen-bar-icon">{meta.icon}</span>
      <input
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
  );
}
