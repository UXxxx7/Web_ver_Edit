// Client-safe types mirroring apps/api's Job model — see
// apps/api/app/webhook.py's get_job_endpoint for the exact response shape
// this is kept in sync with by hand (no shared schema between the two
// services yet; see phase2_video_pipeline_plan.md).
export type JobStatus =
  | "RECEIVED"
  | "COLLECTING_ASSETS"
  | "NEEDS_TARGET_CHOICE"
  | "DOWNLOADING_MEDIA"
  | "PLANNING"
  | "NEEDS_CLARIFICATION"
  | "WAITING_CONFIRMATION"
  | "RUNNING_PIPELINE"
  | "RENDERING"
  | "DELIVERING"
  | "PREVIEW_READY"
  | "CLIPS_READY"
  | "DONE"
  | "ERROR";

export type EditOperation = { type: string; [key: string]: unknown };
export type PlannedEdit = { summary?: string; edit_operations: EditOperation[] };

export type EditJob = {
  job_id: string;
  status: JobStatus;
  input_video_path: string | null;
  preview_path: string | null;
  final_path: string | null;
  planned_edit: PlannedEdit | null;
  error_message: string | null;
  edit_request: string;
  degraded_operations: string[];
  generation_cost_usd: number;
  pipeline: string;
  created_at: string | null;
  updated_at: string | null;
};

export function basename(path: string | null): string | null {
  if (!path) return null;
  return path.split("/").pop() ?? null;
}

// Statuses where polling should keep going.
export const IN_PROGRESS_STATUSES: JobStatus[] = [
  "RECEIVED", "DOWNLOADING_MEDIA", "PLANNING", "RUNNING_PIPELINE", "RENDERING", "DELIVERING",
];

export const OPERATION_LABELS: Record<string, string> = {
  remove_filler: "Remove filler words & false starts",
  remove_silences: "Cut dead air / long pauses",
  add_subtitles: "Burn in subtitles",
  apply_style: "Apply animated template",
  insert_broll: "Insert b-roll",
  auto_reframe: "Auto-reframe to 9:16",
  color_grade: "Color grade",
};

export const OPERATION_LABELS_ZH: Record<string, string> = {
  remove_filler: "剪走贅字同重講嘅位",
  remove_silences: "剪走靜音位/長停頓",
  add_subtitles: "加字幕",
  apply_style: "套用動畫樣式",
  insert_broll: "加插B-roll",
  auto_reframe: "自動剪裁做9:16直度",
  color_grade: "調色",
};
