"use client";

import { useState } from "react";
import { extendCombinedScriptAction } from "@/app/(app)/actions";
import type {
  Beat, CombinedScriptResult, ContentIdeaResult, GenerationKind, ShootingScriptResult, VideoScriptResult,
} from "@/lib/generation-types";

// Matches whatsapp_mvp/lang.py's detect_lang() exactly — same regex used
// in Dashboard.tsx's submit(), needed here too so "generate more" sends the
// right lang without threading it down as a separate prop.
const CJK_RE = /[一-鿿㐀-䶿]/;

// Hand-drawn line icons — same treatment as FeatureHub/TemplateGallery,
// deliberately not emoji.
const ICONS = {
  copy: "M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16 M4 9.5A1.5 1.5 0 0 1 5.5 8h9A1.5 1.5 0 0 1 16 9.5v9A1.5 1.5 0 0 1 14.5 20h-9A1.5 1.5 0 0 1 4 18.5v-9Z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M16.2 16.2 21 21",
  lightbulb: "M9 18h6 M9.5 21h5 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.5V12l3 2",
  // Talking-head vs B-roll — same distinction the shooting-script prompt
  // now asks the model to tag each shot with, surfaced so it's obvious at
  // a glance which shots are to-camera and which are cutaway footage.
  face: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5",
  film: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4",
  plus: "M12 5v14M5 12h14",
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

function beatsToText(beats: Beat[]): string {
  return beats
    .map((b) => `[${b.label} · ${b.kind === "broll" ? "B-roll" : "望鏡頭"}${b.shot_type ? " · " + b.shot_type : ""}]${b.dialogue ? "\n" + b.dialogue : ""}`)
    .join("\n\n");
}

function CombinedScriptCard({
  result, direction, movement,
}: {
  result: CombinedScriptResult;
  direction: string;
  movement?: string;
}) {
  const [beats, setBeats] = useState(result.beats);
  const [duration, setDuration] = useState(result.estimated_duration_seconds);
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const handleMore = async () => {
    setExtending(true);
    setExtendError(null);
    const lang: "zh" | "en" = CJK_RE.test(direction) ? "zh" : "en";
    const outcome = await extendCombinedScriptAction(direction, lang, movement, beats);
    setExtending(false);
    if ("error" in outcome) {
      setExtendError(outcome.error);
      return;
    }
    setBeats((prev) => [...prev, ...outcome.beats]);
    if (outcome.estimated_duration_seconds) {
      setDuration((prev) => (prev ?? 0) + outcome.estimated_duration_seconds!);
    }
  };

  return (
    <div className="gen-card">
      {result.title && <div className="gen-summary font-semibold">{result.title}</div>}
      {duration ? (
        <div className="total-duration"><Icon path={ICONS.clock} /> ~{Math.round(duration)}s spoken</div>
      ) : null}
      <div className="mt-2 flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
        {beats.map((b, i) => (
          <div key={i} className="grid grid-cols-[120px_1fr] gap-3 p-2.5 text-[12.5px]">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Icon path={b.kind === "broll" ? ICONS.film : ICONS.face} size={12} />
                {b.label}
              </span>
              {b.shot_type && <span className="text-muted-foreground">{b.shot_type}</span>}
            </div>
            <div className="whitespace-pre-line text-foreground">
              {b.dialogue || <span className="text-muted-foreground">（畫面停頓，無對白）</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="gen-actions items-center">
        <CopyButton text={beatsToText(beats)} label="Copy script + shots" />
        <button type="button" onClick={handleMore} disabled={extending}>
          {extending ? "加緊…" : (
            <>
              <Icon path={ICONS.plus} /> 加多啲
            </>
          )}
        </button>
      </div>
      {extendError && <p className="mt-1 text-[11.5px] text-destructive">{extendError}</p>}
      <Sources grounded={result.grounded} sources={result.sources} />
    </div>
  );
}

// A one-line preview shown while collapsed, so tapping to expand isn't a
// total guess at what's underneath.
function summaryOf(kind: GenerationKind, result: ResultCardProps["result"]): string {
  if (kind === "combined_script") {
    const r = result as CombinedScriptResult;
    return r.title || r.beats[0]?.dialogue || "";
  }
  if (kind === "video_script") return (result as VideoScriptResult).script;
  if (kind === "shooting_script") return (result as ShootingScriptResult).summary;
  return (result as ContentIdeaResult).caption;
}

type ResultCardProps = {
  kind: GenerationKind;
  result: VideoScriptResult | ShootingScriptResult | ContentIdeaResult | CombinedScriptResult;
  direction?: string;
  movement?: string;
  // Long mobile pages (a stack of past generation results, each a full
  // script/shot-list) meant a lot of scrolling just to reach anything below
  // the newest one. Older results now start collapsed to a one-line
  // summary — Dashboard.tsx only passes true for turns after the first
  // (newest) one.
  defaultCollapsed?: boolean;
};

export function ResultCard({ kind, result, direction = "", movement, defaultCollapsed = false }: ResultCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50"
      >
        <span className="line-clamp-1 text-[13px] text-muted-foreground">{summaryOf(kind, result)}</span>
        <span className="shrink-0 text-[12px] font-semibold text-foreground">睇詳情</span>
      </button>
    );
  }
  return <ResultCardContent kind={kind} result={result} direction={direction} movement={movement} />;
}

function ResultCardContent({
  kind,
  result,
  direction = "",
  movement,
}: {
  kind: GenerationKind;
  result: VideoScriptResult | ShootingScriptResult | ContentIdeaResult | CombinedScriptResult;
  direction?: string;
  movement?: string;
}) {
  if (kind === "combined_script") {
    return <CombinedScriptCard result={result as CombinedScriptResult} direction={direction} movement={movement} />;
  }

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
      .map((s, i) => `${i + 1}. [${s.kind === "broll" ? "B-roll" : "望鏡頭"} · ${s.shot_type || "—"}, ${s.duration_hint || "?"}] ${s.content}`)
      .join("\n");
    return (
      <div className="gen-card">
        <div className="gen-summary">{r.summary}</div>
        {r.total_duration_estimate ? <div className="total-duration"><Icon path={ICONS.clock} /> Total: {r.total_duration_estimate}</div> : null}
        <ol>
          {r.shots.map((s, i) => (
            <li key={i}>
              <span className="shot-meta">
                <Icon path={s.kind === "broll" ? ICONS.film : ICONS.face} size={12} />{" "}
                {s.kind === "broll" ? "B-roll" : "望鏡頭"} · {s.label} · {s.shot_type || "—"} · {s.duration_hint || "?"}
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
