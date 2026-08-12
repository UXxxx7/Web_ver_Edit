// Clickable edit-instruction presets for the video-edit flow's Step 1.
// Unlike the photo flow (which needs an AI-generated script — a topic to
// write about), an existing video doesn't need a script, it needs edit
// instructions — so these are canned phrases, not generated content.
// Mirrors the pipeline's real supported operations (see
// lib/edit-jobs.ts's OPERATION_LABELS) so every suggestion here is
// something the backend can actually do, not just plausible-sounding copy.
import type { Lang } from "./i18n";

export type EditSuggestion = { label: string; text: string };

export const EDIT_SUGGESTIONS: Record<Lang, EditSuggestion[]> = {
  zh: [
    { label: "剪走贅字", text: "剪走贅字同重講嘅位" },
    { label: "剪走靜音位", text: "剪走靜音位/長停頓" },
    { label: "加字幕", text: "加繁體中文字幕" },
    { label: "剪做直度", text: "自動裁剪做9:16直度" },
    { label: "加插B-roll", text: "適當位置加插B-roll" },
  ],
  en: [
    { label: "Remove filler", text: "Remove filler words and false starts" },
    { label: "Cut silences", text: "Cut dead air and long pauses" },
    { label: "Add captions", text: "Burn in captions" },
    { label: "Reframe 9:16", text: "Auto-reframe to 9:16" },
    { label: "Insert b-roll", text: "Insert b-roll where relevant" },
  ],
};
