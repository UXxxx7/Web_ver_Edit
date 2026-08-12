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

// Icons don't vary by UI language; label/placeholder do — see TOOL_TEXT.
export const TOOL_ICONS: Record<GenerationKind, string> = {
  video_script: "📝",
  shooting_script: "🎬",
  content_idea: "💡",
};

export const TOOL_TEXT = {
  zh: {
    video_script: { label: "寫劇本", placeholder: "畀個方向 — 想條片喺鏡頭前講咩？" },
    shooting_script: { label: "計劃拍攝", placeholder: "畀個方向 — 攞返個逐個鏡頭嘅拍攝清單" },
    content_idea: { label: "攞靈感", placeholder: "畀個方向 — 例如「自願醫保最新政策」— 攞個帖文範例" },
  },
  en: {
    video_script: { label: "Write script", placeholder: "Give a direction — what should the video say on camera?" },
    shooting_script: { label: "Plan shots", placeholder: "Give a direction — get a shot list for how to film it" },
    content_idea: { label: "Get idea", placeholder: "Give a direction — e.g. “自願醫保最新政策” — get a sample post idea" },
  },
} as const;

// Back-compat shape (icon + English text) for any caller that only needs
// the icon (language-independent) without threading a lang prop through.
export const TOOL_META = {
  video_script: { icon: TOOL_ICONS.video_script, ...TOOL_TEXT.en.video_script },
  shooting_script: { icon: TOOL_ICONS.shooting_script, ...TOOL_TEXT.en.shooting_script },
  content_idea: { icon: TOOL_ICONS.content_idea, ...TOOL_TEXT.en.content_idea },
} as const;
