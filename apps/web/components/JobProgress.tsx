"use client";

// Shared job-lifecycle display — used by VideoEditor.tsx (direct upload)
// and CrollCreator.tsx (photo -> HeyGen digital human), because /croll
// merges into the exact same Job state machine as /jobs once the source
// clip exists (see webhook.py's create_croll_endpoint docstring: "接入常规
// 剪辑管线（后续 confirm/export/retry 跟普通视频任务完全一样）"). Only the
// *creation* step differs between the two callers — everything from here
// on (poll/confirm/preview/revise/export) is identical.
import { useEffect, useState } from "react";
import {
  confirmEditJob, getEditJobStatus, renderEditJob, retryEditJob, reviseEditJob,
  type ActionResult,
} from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  basename, IN_PROGRESS_STATUSES, OPERATION_LABELS, OPERATION_LABELS_ZH, type EditJob,
} from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

const POLL_MS = 4000;

const STATUS_COPY: Record<Lang, Partial<Record<EditJob["status"], string>>> = {
  en: {
    RECEIVED: "Uploaded — starting up…",
    DOWNLOADING_MEDIA: "Fetching assets…",
    PLANNING: "Watching your video and planning the edit… (transcription + LLM planning, can take a minute or two)",
    RUNNING_PIPELINE: "Editing your video…",
    RENDERING: "Rendering the final video…",
    DELIVERING: "Wrapping up…",
  },
  zh: {
    RECEIVED: "上載完成 — 準備緊…",
    DOWNLOADING_MEDIA: "攞緊素材…",
    PLANNING: "睇緊你條片同計劃緊點剪…（轉錄+AI計劃，可能要一兩分鐘）",
    RUNNING_PIPELINE: "剪緊你條片…",
    RENDERING: "渲染緊final片…",
    DELIVERING: "執緊尾…",
  },
};

const DICT = {
  zh: {
    proposedEdit: "建議嘅剪接",
    confirmRun: "確認同開始",
    preview: "預覽",
    degraded: (ops: string) => `有啲步驟未完全完成：${ops}。你依然可以匯出，或者修改再試多次。`,
    exportFinal: "匯出final片",
    finalVideo: "Final片",
    download: "下載",
    startAnother: "整多條",
    startOver: "由頭嚟過",
    somethingWrong: "出咗啲問題。",
    retry: "重試",
    needsClarification: "計劃工具需要多啲資料先可以建議點剪。呢個流程仲未有專門方法答問題 — 不如寫清楚啲重新開始。",
    reviseLabel: "唔啱？講吓想點改：",
    revisePh: "例如：字幕太快，慢一點",
    revise: "修改",
  },
  en: {
    proposedEdit: "Proposed edit",
    confirmRun: "Confirm & run",
    preview: "Preview",
    degraded: (ops: string) => `Some steps didn't fully complete: ${ops}. You can still export, or revise and retry.`,
    exportFinal: "Export final video",
    finalVideo: "Final video",
    download: "Download",
    startAnother: "Start another",
    startOver: "Start over",
    somethingWrong: "Something went wrong.",
    retry: "Retry",
    needsClarification: "The planner needs more detail before it can propose an edit. This flow doesn't have a dedicated way to answer yet — try starting over with a more specific description.",
    reviseLabel: "Not quite right? Describe what to change:",
    revisePh: "e.g. 字幕太快，慢一點",
    revise: "Revise",
  },
} satisfies Record<Lang, unknown>;

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

export function JobProgress({
  job, onUpdate, onReset, lang,
}: {
  job: EditJob;
  onUpdate: (job: EditJob) => void;
  onReset: () => void;
  lang: Lang;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const t = DICT[lang];
  const opLabels = lang === "zh" ? OPERATION_LABELS_ZH : OPERATION_LABELS;

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
      {STATUS_COPY[lang][job.status] && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="dash-spinner" />
            <p className="text-sm text-muted-foreground">{STATUS_COPY[lang][job.status]}</p>
          </CardContent>
        </Card>
      )}

      {job.status === "WAITING_CONFIRMATION" && job.planned_edit && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t.proposedEdit}</h3>
              {job.planned_edit.summary && (
                <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">{job.planned_edit.summary}</p>
              )}
              <ul className="flex flex-col gap-1.5">
                {job.planned_edit.edit_operations.map((op, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {opLabels[op.type] ?? op.type}
                  </li>
                ))}
              </ul>
            </div>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button disabled={actionPending} onClick={() => runAction(() => confirmEditJob(job.job_id))}>
                {t.confirmRun}
              </Button>
            </div>
            <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} t={t} />
          </CardContent>
        </Card>
      )}

      {job.status === "PREVIEW_READY" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">{t.preview}</h3>
            {fileUrl(job.job_id, job.preview_path) && (
              <video controls className="w-full rounded-lg" src={fileUrl(job.job_id, job.preview_path)!} />
            )}
            {job.degraded_operations.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t.degraded(job.degraded_operations.join(", "))}
              </p>
            )}
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button disabled={actionPending} onClick={() => runAction(() => renderEditJob(job.job_id))}>
                {t.exportFinal}
              </Button>
            </div>
            <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} t={t} />
          </CardContent>
        </Card>
      )}

      {job.status === "DONE" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold">{t.finalVideo}</h3>
            {fileUrl(job.job_id, job.final_path) && (
              <>
                <video controls className="w-full rounded-lg" src={fileUrl(job.job_id, job.final_path)!} />
                <a
                  href={fileUrl(job.job_id, job.final_path)!}
                  download
                  className="w-fit rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  {t.download}
                </a>
              </>
            )}
            <Button variant="outline" className="w-fit" onClick={onReset}>{t.startAnother}</Button>
          </CardContent>
        </Card>
      )}

      {job.status === "ERROR" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-destructive">{job.error_message || t.somethingWrong}</p>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button disabled={actionPending} onClick={() => runAction(() => retryEditJob(job.job_id))}>
                {t.retry}
              </Button>
              <Button variant="outline" onClick={onReset}>{t.startOver}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {job.status === "NEEDS_CLARIFICATION" && (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t.needsClarification}</p>
            <Button variant="outline" className="mt-3 w-fit" onClick={onReset}>{t.startOver}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviseBox({
  text, setText, disabled, onSubmit, t,
}: {
  text: string; setText: (v: string) => void; disabled: boolean; onSubmit: () => void;
  t: typeof DICT["en"] | typeof DICT["zh"];
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <label className="text-xs font-medium text-muted-foreground">{t.reviseLabel}</label>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.revisePh} />
      <Button variant="outline" size="sm" className="w-fit" disabled={disabled || !text.trim()} onClick={onSubmit}>
        {t.revise}
      </Button>
    </div>
  );
}
