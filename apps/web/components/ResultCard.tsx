"use client";

import { useState } from "react";
import type {
  ContentIdeaResult, GenerationKind, ShootingScriptResult, VideoScriptResult,
} from "@/lib/generation-types";

function CopyButton({ text, label }: { text: string; label: string }) {
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
      {copied ? "Copied!" : label}
    </button>
  );
}

function Sources({ grounded, sources }: { grounded: boolean; sources: { uri: string; title: string }[] }) {
  if (grounded && sources.length) {
    return (
      <div className="gen-sources">
        🔎 Based on {sources.length} current source{sources.length > 1 ? "s" : ""}:{" "}
        {sources.map((s, i) => (
          <a key={s.uri} href={s.uri} target="_blank" rel="noopener noreferrer">
            [{i + 1}]
          </a>
        ))}
      </div>
    );
  }
  return <div className="gen-sources">💭 From general knowledge (no live search results used this time)</div>;
}

export function ResultCard({
  kind,
  result,
}: {
  kind: GenerationKind;
  result: VideoScriptResult | ShootingScriptResult | ContentIdeaResult;
}) {
  if (kind === "video_script") {
    const r = result as VideoScriptResult;
    return (
      <div className="gen-card">
        <div className="gen-body">{r.script}</div>
        {r.estimated_duration_seconds ? (
          <div className="total-duration">⏱ ~{Math.round(r.estimated_duration_seconds)}s spoken</div>
        ) : null}
        <div className="gen-actions">
          <CopyButton text={r.script} label="📋 Copy script" />
        </div>
        <Sources grounded={r.grounded} sources={r.sources} />
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
        {r.total_duration_estimate ? <div className="total-duration">⏱ Total: {r.total_duration_estimate}</div> : null}
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
          <CopyButton text={shotsText} label="📋 Copy shot list" />
        </div>
        <Sources grounded={r.grounded} sources={r.sources} />
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
        <CopyButton text={full} label="📋 Copy caption" />
      </div>
      <Sources grounded={r.grounded} sources={r.sources} />
    </div>
  );
}
