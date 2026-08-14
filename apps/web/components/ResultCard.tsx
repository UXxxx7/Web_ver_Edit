"use client";

import { useState } from "react";
import type {
  ContentIdeaResult, GenerationKind, ShootingScriptResult, VideoScriptResult,
} from "@/lib/generation-types";

// Hand-drawn line icons — same treatment as FeatureHub/TemplateGallery,
// deliberately not emoji.
const ICONS = {
  copy: "M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16 M4 9.5A1.5 1.5 0 0 1 5.5 8h9A1.5 1.5 0 0 1 16 9.5v9A1.5 1.5 0 0 1 14.5 20h-9A1.5 1.5 0 0 1 4 18.5v-9Z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M16.2 16.2 21 21",
  lightbulb: "M9 18h6 M9.5 21h5 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5V12l3 2",
};

function Icon({ path, size = 13 }: { path: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-2px]"
    >
      <path d={path} />
    </svg>
  );
}

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
      {copied ? "Copied!" : (
        <>
          <Icon path={ICONS.copy} /> {label}
        </>
      )}
    </button>
  );
}

function Sources({ grounded, sources }: { grounded: boolean; sources: { uri: string; title: string }[] }) {
  if (grounded && sources.length) {
    return (
      <div className="gen-sources">
        <Icon path={ICONS.search} /> Based on {sources.length} current source{sources.length > 1 ? "s" : ""}:{" "}
        {sources.map((s, i) => (
          <a key={`${s.uri}-${i}`} href={s.uri} target="_blank" rel="noopener noreferrer">
            [{i + 1}]
          </a>
        ))}
      </div>
    );
  }
  return (
    <div className="gen-sources">
      <Icon path={ICONS.lightbulb} /> From general knowledge (no live search results used this time)
    </div>
  );
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
          <div className="total-duration"><Icon path={ICONS.clock} /> ~{Math.round(r.estimated_duration_seconds)}s spoken</div>
        ) : null}
        <div className="gen-actions">
          <CopyButton text={r.script} label="Copy script" />
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
        {r.total_duration_estimate ? <div className="total-duration"><Icon path={ICONS.clock} /> Total: {r.total_duration_estimate}</div> : null}
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
          <CopyButton text={shotsText} label="Copy shot list" />
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
        <CopyButton text={full} label="Copy caption" />
      </div>
      <Sources grounded={r.grounded} sources={r.sources} />
    </div>
  );
}
