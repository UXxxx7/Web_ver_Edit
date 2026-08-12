"use client";

// Shared job-lifecycle display — used by VideoEditor.tsx (direct upload)
// and CrollCreator.tsx (photo -> HeyGen digital human), because /croll
// merges into the exact same Job state machine as /jobs once the source
// clip exists (see webhook.py's create_croll_endpoint docstring: "接入常规
// 剪辑管线（后续 confirm/export/retry 跟普通视频任务完全一样）"). Only the
// *creation* step differs between the two callers — everything from here
// on (poll/confirm/preview/revise/export) is identical.
import { useEffect, useRef, useState } from "react";
import {
  confirmEditJob, getEditJobStatus, renderEditJob, retryEditJob, reviseEditJob,
  type ActionResult,
} from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  basename, IN_PROGRESS_STATUSES, OPERATION_LABELS, type EditJob,
} from "@/lib/edit-jobs";

const POLL_MS = 4000;

const STATUS_COPY: Partial<Record<EditJob["status"], string>> = {
  RECEIVED: "Uploaded — starting up…",
  DOWNLOADING_MEDIA: "Fetching assets…",
  PLANNING: "Watching your video and planning the edit… (transcription + LLM planning, can take a minute or two)",
  RUNNING_PIPELINE: "Editing your video…",
  RENDERING: "Rendering the final video…",
  DELIVERING: "Wrapping up…",
};

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

export function JobProgress({
  job, onUpdate, onReset,
}: {
  job: EditJob;
  onUpdate: (job: EditJob) => void;
  onReset: () => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reviseText, setReviseText] = useState("");

  // Poll while in-progress; stop once the job is waiting on the user (or terminal).
  useEffect(() => {
    if (!IN_PROGRESS_STATUSES.includes(job.status)) return;
    const jobId = job.job_id;
    const id = setInterval(async () => {
      const result = await getEditJobStatus(jobId);
      if (result.ok) onUpdate(result.data);
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.status, job.job_id]);

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

  const revise = () =>
    runAction(async () => {
      const r = await reviseEditJob(job.job_id, reviseText);
      if (r.ok) setReviseText("");
      return r;
    });

  return (
    <div className="flex flex-col gap-4">
      {STATUS_COPY[job.status] && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="dash-spinner" />
            <p className="text-sm text-muted-foreground">{STATUS_COPY[job.status]}</p>
          </CardContent>
        </Card>
      )}

      {job.status === "WAITING_CONFIRMATION" && job.planned_edit && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Proposed edit</h3>
              {job.planned_edit.summary && (
                <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">{job.planned_edit.summary}</p>
              )}
              <ul className="flex flex-col gap-1.5">
                {job.planned_edit.edit_operations.map((op, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {OPERATION_LABELS[op.type] ?? op.type}
                  </li>
                ))}
              </ul>
            </div>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button disabled={actionPending} onClick={() => runAction(() => confirmEditJob(job.job_id))}>
                Confirm & run
              </Button>
            </div>
            <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} />
          </CardContent>
        </Card>
      )}

      {job.status === "PREVIEW_READY" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Preview</h3>
            {fileUrl(job.job_id, job.preview_path) && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video controls className="w-full rounded-lg" src={fileUrl(job.job_id, job.preview_path)!} />
            )}
            {job.degraded_operations.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Some steps didn&apos;t fully complete: {job.degraded_operations.join(", ")}. You can still export, or revise and retry.
              </p>
            )}
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button disabled={actionPending} onClick={() => runAction(() => renderEditJob(job.job_id))}>
                Export final video
              </Button>
            </div>
            <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} />
          </CardContent>
        </Card>
      )}

      {job.status === "DONE" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">Final video</h3>
            {fileUrl(job.job_id, job.final_path) && (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video controls className="w-full rounded-lg" src={fileUrl(job.job_id, job.final_path)!} />
                <a
                  href={fileUrl(job.job_id, job.final_path)!}
                  download
                  className="w-fit rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  Download
                </a>
              </>
            )}
            <Button variant="outline" className="w-fit" onClick={onReset}>Start another</Button>
          </CardContent>
        </Card>
      )}

      {job.status === "ERROR" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-destructive">{job.error_message || "Something went wrong."}</p>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button disabled={actionPending} onClick={() => runAction(() => retryEditJob(job.job_id))}>
                Retry
              </Button>
              <Button variant="outline" onClick={onReset}>Start over</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {job.status === "NEEDS_CLARIFICATION" && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The planner needs more detail before it can propose an edit. This flow doesn&apos;t have a
              dedicated way to answer yet — try starting over with a more specific description.
            </p>
            <Button variant="outline" className="mt-3 w-fit" onClick={onReset}>Start over</Button>
          </CardContent>
        </Card>
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
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <label className="text-xs font-medium text-muted-foreground">Not quite right? Describe what to change:</label>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 字幕太快，慢一點" />
      <Button variant="outline" size="sm" className="w-fit" disabled={disabled || !text.trim()} onClick={onSubmit}>
        Revise
      </Button>
    </div>
  );
}
