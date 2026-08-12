// Result shapes returned by apps/api — mirror the dicts video_script.py /
// shooting_script.py / content_idea.py return in OpenMontage-p2/whatsapp_mvp.
// Client-safe (no "server-only" import) — lib/data.ts re-exports
// GenerationKind from here rather than the other way around, so Client
// Components can import types without pulling in server-only code.
export type GenerationKind = "video_script" | "shooting_script" | "content_idea";

export type Source = { uri: string; title: string };

export type VideoScriptResult = {
  script: string;
  estimated_duration_seconds: number | null;
  sources: Source[];
  grounded: boolean;
};

export type Shot = { label: string; shot_type?: string; duration_hint?: string; content: string };
export type ShootingScriptResult = {
  summary: string;
  shots: Shot[];
  total_duration_estimate?: string;
  sources: Source[];
  grounded: boolean;
};

export type ContentIdeaResult = {
  caption: string;
  hashtags: string[];
  sources: Source[];
  grounded: boolean;
};

export const TOOL_META = {
  video_script: { icon: "📝", label: "Write script", placeholder: "Give a direction — what should the video say on camera?" },
  shooting_script: { icon: "🎬", label: "Plan shots", placeholder: "Give a direction — get a shot list for how to film it" },
  content_idea: { icon: "💡", label: "Get idea", placeholder: "Give a direction — e.g. “自願醫保最新政策” — get a sample post idea" },
} as const;
