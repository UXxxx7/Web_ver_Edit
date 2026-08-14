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

// `icon` is an SVG <path d="..."> string, not an emoji — rendered via a
// small <svg><path/></svg> wrapper wherever it's used (see Dashboard.tsx's
// ToolIcon). Kept as a plain string here (not JSX) so this file can stay
// a plain .ts module.
export const TOOL_META = {
  video_script: {
    icon: "M5 4.5h9l5 5V19a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 19V5A.5.5 0 0 1 5 4.5Z M14 4.5V9h4.5 M8 13h8M8 16h5",
    label: "Write script", placeholder: "Give a direction — what should the video say on camera?",
  },
  shooting_script: {
    icon: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3 M7 5v3.2M11 5v3.2M4 8.2h9",
    label: "Plan shots", placeholder: "Give a direction — get a shot list for how to film it",
  },
  content_idea: {
    icon: "M9 18h6 M9.5 21h5 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
    label: "Get idea", placeholder: "Give a direction — e.g. “自願醫保最新政策” — get a sample post idea",
  },
} as const;
