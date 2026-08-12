"use client";

// Renders a Job's lifecycle INSIDE a chat bubble (a bot message that
// updates itself in place) — the WhatsApp-shaped counterpart to
// JobProgress.tsx's card-based version it replaced. Same polling/action
// logic (confirm/render/revise/retry against apps/api's proven /jobs
// contract), different presentation: no outer <Card>, no "start over"
// (in a chat thread you just send the next attachment — old messages stay
// in the transcript, same as a real WhatsApp conversation).
import { useEffect, useState } from "react";
import {
  confirmEditJob, getEditJobStatus, getEditorUrl, renderEditJob, retryEditJob, reviseEditJob,
  type ActionResult,
} from "@/app/(app)/agent/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basename, IN_PROGRESS_STATUSES, OPERATION_LABELS, type EditJob } from "@/lib/edit-jobs";

const POLL_MS = 4000;

const STATUS_COPY: Partial<Record<EditJob["status"], string>> = {
  RECEIVED: "Uploaded — starting up…",
  DOWNLOADING_MEDIA: "Fetching assets…",
  PLANNING: "Watching your video and planning the edit… (can take a minute or two)",
  RUNNING_PIPELINE: "Editing your video…",
  RENDERING: "Rendering the final video…",
  DELIVERING: "Wrapping up…",
};

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

export function AgentJobBubble({ job, onUpdate }: { job: EditJob; onUpdate: (job: EditJob) => void }) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [reviseOpen, setReviseOpen] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);

  useEffect(() => {
    // Skip polling for the PENDING placeholder (empty job_id) — it has an
    // in-progress status but no real id yet, so polling would hit `/jobs/`
    // (empty) in a loop (307 -> 405) until AgentChat swaps in the real job.
    if (!job.job_id || !IN_PROGRESS_STATUSES.includes(job.status)) return;
    const jobId = job.job_id;
    const id = setInterval(async () => {
      const result = await getEditJobStatus(jobId);
      if (result.ok) onUpdate(result.data);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [job.status, job.job_id, onUpdate]);

  async function runAction(fn: () => Promise<ActionResult<{ status: string }>>) {
    setActionError(null);
    setActionPending(true);
    const result = await fn();
    setActionPending(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    const status = await getEditJobStatus(job.job_id);
    if (status.ok) onUpdate(status.data);
  }

  async function openEditor() {
    const result = await getEditorUrl(job.job_id);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setEditorUrl(result.data.editorUrl);
    window.open(result.data.editorUrl, "_blank", "noopener,noreferrer");
  }

  const revise = () =>
    runAction(async () => {
      const r = await reviseEditJob(job.job_id, reviseText);
      if (r.ok) {
        setReviseText("");
        setReviseOpen(false);
      }
      return r;
    });

  return (
    <div className="flex flex-col gap-3">
      {STATUS_COPY[job.status] && (
        <p className="flex items-center gap-2">
          <span className="dash-spinner" />
          {STATUS_COPY[job.status]}
        </p>
      )}

      {job.status === "WAITING_CONFIRMATION" && job.planned_edit && (
        <>
          {job.planned_edit.summary && <p className="whitespace-pre-wrap">{job.planned_edit.summary}</p>}
          <ul className="flex flex-col gap-1">
            {job.planned_edit.edit_operations.map((op, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {OPERATION_LABELS[op.type] ?? op.type}
              </li>
            ))}
          </ul>
          {actionError && <p className="text-destructive">{actionError}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={actionPending} onClick={() => runAction(() => confirmEditJob(job.job_id))}>
              Confirm & run
            </Button>
            <Button size="sm" variant="outline" disabled={actionPending} onClick={() => setReviseOpen((v) => !v)}>
              Revise
            </Button>
          </div>
          {reviseOpen && <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} />}
        </>
      )}

      {job.status === "PREVIEW_READY" && (
        <>
          {fileUrl(job.job_id, job.preview_path) && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video controls className="w-full max-w-[280px] rounded-lg" src={fileUrl(job.job_id, job.preview_path)!} />
          )}
          {job.degraded_operations.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              Some steps didn&apos;t fully complete: {job.degraded_operations.join(", ")}. You can still export, or revise and retry.
            </p>
          )}
          {actionError && <p className="text-destructive">{actionError}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={actionPending} onClick={() => runAction(() => renderEditJob(job.job_id))}>
              Export final video
            </Button>
            <Button size="sm" variant="outline" disabled={actionPending} onClick={() => setReviseOpen((v) => !v)}>
              Revise
            </Button>
            <Button size="sm" variant="outline" onClick={openEditor}>
              Open manual editor
            </Button>
          </div>
          {reviseOpen && <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} />}
        </>
      )}

      {job.status === "DONE" && (
        <>
          {fileUrl(job.job_id, job.final_path) && (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls className="w-full max-w-[280px] rounded-lg" src={fileUrl(job.job_id, job.final_path)!} />
              <a
                href={fileUrl(job.job_id, job.final_path)!}
                download
                className="w-fit rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold hover:border-accent hover:text-accent"
              >
                Download
              </a>
            </>
          )}
        </>
      )}

      {job.status === "ERROR" && (
        <>
          <p className="text-destructive">{job.error_message || "Something went wrong."}</p>
          {actionError && <p className="text-destructive">{actionError}</p>}
          <Button size="sm" disabled={actionPending} className="w-fit" onClick={() => runAction(() => retryEditJob(job.job_id))}>
            Retry
          </Button>
        </>
      )}

      {job.status === "NEEDS_CLARIFICATION" && (
        <p className="text-muted-foreground">
          I need more detail before I can propose an edit — try sending a new attachment with a more
          specific description.
        </p>
      )}

      {editorUrl && (
        <p className="text-[11px] text-muted-foreground">
          Editor link: <a className="underline" href={editorUrl} target="_blank" rel="noopener noreferrer">{editorUrl}</a>
        </p>
      )}
    </div>
  );
}

function ReviseBox({
  text, setText, disabled, onSubmit,
}: {
  text: string; setText: (v: string) => void; disabled: boolean; onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 字幕太快，慢一點" />
      <Button size="sm" variant="outline" className="w-fit" disabled={disabled || !text.trim()} onClick={onSubmit}>
        Send
      </Button>
    </div>
  );
}
