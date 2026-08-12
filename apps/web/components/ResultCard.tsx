"use client";

import { useState } from "react";
import type {
  ContentIdeaResult, GenerationKind, ShootingScriptResult, VideoScriptResult,
} from "@/lib/generation-types";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    copied: "已複製！",
    copyScript: "📋 複製劇本",
    copyShotlist: "📋 複製拍攝清單",
    copyCaption: "📋 複製文案",
    spoken: (s: number) => `⏱ 大約 ${s} 秒讀完`,
    total: (t: string) => `⏱ 總長度：${t}`,
    basedOn: (n: number) => `🔎 根據 ${n} 個最新資料來源：`,
    general: "💭 憑一般知識作答（今次冇用到即時搜尋結果）",
  },
  en: {
    copied: "Copied!",
    copyScript: "📋 Copy script",
    copyShotlist: "📋 Copy shot list",
    copyCaption: "📋 Copy caption",
    spoken: (s: number) => `⏱ ~${s}s spoken`,
    total: (t: string) => `⏱ Total: ${t}`,
    basedOn: (n: number) => `🔎 Based on ${n} current source${n > 1 ? "s" : ""}:`,
    general: "💭 From general knowledge (no live search results used this time)",
  },
} satisfies Record<Lang, unknown>;

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

function Sources({ grounded, sources, lang }: { grounded: boolean; sources: { uri: string; title: string }[]; lang: Lang }) {
  const t = DICT[lang];
  if (grounded && sources.length) {
    return (
      <div className="gen-sources">
        {t.basedOn(sources.length)}{" "}
        {sources.map((s, i) => (
          <a key={s.uri} href={s.uri} target="_blank" rel="noopener noreferrer">
            [{i + 1}]
          </a>
        ))}
      </div>
    );
  }
  return <div className="gen-sources">{t.general}</div>;
}

export function ResultCard({
  kind,
  result,
  lang,
}: {
  kind: GenerationKind;
  result: VideoScriptResult | ShootingScriptResult | ContentIdeaResult;
  lang: Lang;
}) {
  const t = DICT[lang];

  if (kind === "video_script") {
    const r = result as VideoScriptResult;
    return (
      <div className="gen-card">
        <div className="gen-body">{r.script}</div>
        {r.estimated_duration_seconds ? (
          <div className="total-duration">{t.spoken(Math.round(r.estimated_duration_seconds))}</div>
        ) : null}
        <div className="gen-actions">
          <CopyButton text={r.script} label={t.copyScript} copiedLabel={t.copied} />
        </div>
        <Sources grounded={r.grounded} sources={r.sources} lang={lang} />
      </div>
    );
  }

  if (kind === "shooting_script") {
    const r = result as ShootingScriptResult;
    const shotsText = r.shots
      .map((s, i) => `${i + 1}. [${s.shot_type || "—"}, ${s.duration_hint || "?"}] ${s.content}`)
      .join("\n");
    return (
      <div className="gen-card">
        <div className="gen-summary">{r.summary}</div>
        {r.total_duration_estimate ? <div className="total-duration">{t.total(r.total_duration_estimate)}</div> : null}
        <ol>
          {r.shots.map((s, i) => (
            <li key={i}>
              <span className="shot-meta">
                {s.label} · {s.shot_type || "—"} · {s.duration_hint || "?"}
              </span>
              {s.content}
            </li>
          ))}
        </ol>
        <div className="gen-actions">
          <CopyButton text={shotsText} label={t.copyShotlist} copiedLabel={t.copied} />
        </div>
        <Sources grounded={r.grounded} sources={r.sources} lang={lang} />
      </div>
    );
  }

  const r = result as ContentIdeaResult;
  const full = r.hashtags.length ? `${r.caption}\n\n${r.hashtags.join(" ")}` : r.caption;
  return (
    <div className="gen-card">
      <div className="gen-body">{r.caption}</div>
      <div className="hashtags">{r.hashtags.join(" ")}</div>
      <div className="gen-actions">
        <CopyButton text={full} label={t.copyCaption} copiedLabel={t.copied} />
      </div>
      <Sources grounded={r.grounded} sources={r.sources} lang={lang} />
    </div>
  );
}
