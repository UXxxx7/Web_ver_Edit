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
  // Human-readable current pipeline step ("Removing filler words",
  // "Applying the visual style", etc.) — null until the pipeline actually
  // starts running. See apps/api/app/database.py's Job.current_stage.
  current_stage: string | null;
  edit_request: string;
  degraded_operations: string[];
  generation_cost_usd: number;
  pipeline: string;
  created_at: string | null;
  updated_at: string | null;
};

// GET /users/{id}/videos — the account-level "My Videos" source (apps/api's
// job_manager.list_done_jobs_for_user), replacing the old approach of
// filtering this browser's lib/recent-jobs.ts localStorage list down to
// DONE ones. A trimmed-down cousin of EditJob: only what MyVideos.tsx's
// cards actually render, not the full job shape (no status/preview_path/
// planned_edit — server only returns DONE jobs here, so those don't apply).
export type SavedVideo = {
  job_id: string;
  edit_request: string;
  pipeline: string;
  final_path: string | null;
  created_at: string | null;
};

export function basename(path: string | null): string | null {
  if (!path) return null;
  // Split on both separators — apps/api runs on Windows too, where
  // preview_path/final_path come back as `D:\...\preview.mp4` (backslashes);
  // splitting on "/" alone would return the whole path as the "filename".
  return path.split(/[/\\]/).pop() ?? null;
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
