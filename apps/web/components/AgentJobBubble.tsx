"use client";

// Renders a Job's lifecycle INSIDE a chat bubble (a bot message that
// updates itself in place) — the WhatsApp-shaped counterpart to
// JobProgress.tsx's card-based version it replaced. Same polling/action
// logic (confirm/render/revise/retry against apps/api's proven /jobs
// contract), different presentation: no outer <Card>, no "start over"
// (in a chat thread you just send the next attachment — old messages stay
// in the transcript, same as a real WhatsApp conversation).
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  confirmEditJob, getEditJobStatus, getEditorUrl, renderEditJob, retryEditJob, reviseEditJob,
  type ActionResult,
} from "@/app/(app)/agent/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShareToCommunityPanel } from "@/components/ShareToCommunityPanel";
import { VideoPlayer } from "@/components/VideoPlayer";
import { basename, IN_PROGRESS_STATUSES, operationLabels, type EditJob } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

const POLL_MS = 4000;
// WhatsApp's own worker.js reassures the user roughly every minute of no
// status change rather than leaving a single static spinner up for the
// whole multi-minute render — reproduced here client-side.
const HEARTBEAT_MS = 60000;

const T = {
  en: {
    status: {
      RECEIVED: "Uploaded — starting up…",
      DOWNLOADING_MEDIA: "Fetching assets…",
      PLANNING: "Watching your video and planning the edit… (can take a minute or two)",
      RUNNING_PIPELINE: "Editing your video…",
      RENDERING: "Rendering the final video…",
      DELIVERING: "Wrapping up…",
    } as Partial<Record<EditJob["status"], string>>,
    heartbeat: "Still working on it — this step is taking a little longer than usual, hang tight.",
    confirmRun: "Confirm & run",
    revise: "Revise",
    degraded: (ops: string) => `Some steps didn't fully complete: ${ops}. You can still save, or revise and retry.`,
    saveFinal: "Save final video",
    openEditor: "Open manual editor",
    download: "Download",
    somethingWrong: "Something went wrong.",
    retry: "Retry",
    needsClarification: "I need more detail before I can propose an edit — try sending a new attachment with a more specific description.",
    editorLink: "Editor link:",
    revisePlaceholder: "e.g. captions are too fast, slow them down",
    send: "Send",
  },
  zh: {
    status: {
      RECEIVED: "已上載 — 準備緊…",
      DOWNLOADING_MEDIA: "攞緊素材…",
      PLANNING: "睇緊你條片，度緊點剪…（可能要一兩分鐘）",
      RUNNING_PIPELINE: "剪緊你條片…",
      RENDERING: "轉緊最終影片…",
      DELIVERING: "收尾緊…",
    } as Partial<Record<EditJob["status"], string>>,
    heartbeat: "仲做緊 — 呢步比平時耐少少，唔使急。",
    confirmRun: "確認並開始",
    revise: "修改",
    degraded: (ops: string) => `有幾步未完全做到：${ops}。你都可以照樣儲存，或者修改再試。`,
    saveFinal: "儲存最終影片",
    openEditor: "打開手動編輯器",
    download: "下載",
    somethingWrong: "出咗啲問題。",
    retry: "重試",
    needsClarification: "要多啲資料先可以幫你度個剪片方案 — 試下send多次，加多啲具體描述。",
    editorLink: "編輯器連結：",
    revisePlaceholder: "例如：字幕太快，慢一啲",
    send: "傳送",
  },
} satisfies Record<Lang, {
  status: Partial<Record<EditJob["status"], string>>; heartbeat: string; confirmRun: string; revise: string;
  degraded: (ops: string) => string; saveFinal: string; openEditor: string; download: string;
  somethingWrong: string; retry: string; needsClarification: string; editorLink: string;
  revisePlaceholder: string; send: string;
}>;

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

export function AgentJobBubble({ job, onUpdate, lang }: { job: EditJob; onUpdate: (job: EditJob) => void; lang: Lang }) {
  const t = T[lang];
  const opLabels = operationLabels(lang);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [reviseOpen, setReviseOpen] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  // "Taking longer than usual" hint, shown INSIDE this live bubble after
  // HEARTBEAT_MS in one status, and gone the moment the status advances.
  // Transient by design: the old version appended a permanent chat message
  // every 60s, which piled up and lingered even after the job finished.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    // Reset when the status changes, then turn on HEARTBEAT_MS later via a
    // one-shot timer. This runs only on status/job_id change (dep array), so
    // it can't loop — which is what the set-state-in-effect rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlow(false);
    if (!job.job_id || !IN_PROGRESS_STATUSES.includes(job.status)) return;
    const timer = setTimeout(() => setSlow(true), HEARTBEAT_MS);
    return () => clearTimeout(timer);
  }, [job.status, job.job_id]);

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
      {t.status[job.status] && (
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2">
            <span className="dash-spinner" />
            {t.status[job.status]}
          </p>
          {slow && <p className="pl-6 text-xs text-muted-foreground">{t.heartbeat}</p>}
        </div>
      )}

      {job.status === "WAITING_CONFIRMATION" && job.planned_edit && (
        <>
          {job.planned_edit.summary && (
            <div className="agent-markdown">
              <ReactMarkdown>{job.planned_edit.summary}</ReactMarkdown>
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {job.planned_edit.edit_operations.map((op, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {opLabels[op.type] ?? op.type}
              </li>
            ))}
          </ul>
          {actionError && <p className="text-destructive">{actionError}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={actionPending} onClick={() => runAction(() => confirmEditJob(job.job_id))}>
              {t.confirmRun}
            </Button>
            <Button size="sm" variant="outline" disabled={actionPending} onClick={() => setReviseOpen((v) => !v)}>
              {t.revise}
            </Button>
          </div>
          {reviseOpen && <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} t={t} />}
        </>
      )}

      {job.status === "PREVIEW_READY" && (
        <>
          {fileUrl(job.job_id, job.preview_path) && (
            <VideoPlayer className="w-full max-w-[280px]" src={fileUrl(job.job_id, job.preview_path)!} />
          )}
          {job.degraded_operations.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              {t.degraded(job.degraded_operations.join(", "))}
            </p>
          )}
          {actionError && <p className="text-destructive">{actionError}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" disabled={actionPending} onClick={() => runAction(() => renderEditJob(job.job_id))}>
              {t.saveFinal}
            </Button>
            <Button size="sm" variant="outline" disabled={actionPending} onClick={() => setReviseOpen((v) => !v)}>
              {t.revise}
            </Button>
            <Button size="sm" variant="outline" onClick={openEditor}>
              {t.openEditor}
            </Button>
          </div>
          {reviseOpen && <ReviseBox text={reviseText} setText={setReviseText} disabled={actionPending} onSubmit={revise} t={t} />}
          <ShareToCommunityPanel jobId={job.job_id} lang={lang} />
        </>
      )}

      {job.status === "DONE" && (
        <>
          {fileUrl(job.job_id, job.final_path) && (
            <>
              <VideoPlayer className="w-full max-w-[280px]" src={fileUrl(job.job_id, job.final_path)!} />
              <a
                href={fileUrl(job.job_id, job.final_path)!}
                download
                className="w-fit rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold hover:border-accent hover:text-accent"
              >
                {t.download}
              </a>
              <Button size="sm" variant="outline" className="w-fit" onClick={openEditor}>
                {t.openEditor}
              </Button>
              <ShareToCommunityPanel jobId={job.job_id} lang={lang} />
            </>
          )}
        </>
      )}

      {job.status === "ERROR" && (
        <>
          <p className="text-destructive">{job.error_message || t.somethingWrong}</p>
          {actionError && <p className="text-destructive">{actionError}</p>}
          <Button size="sm" disabled={actionPending} className="w-fit" onClick={() => runAction(() => retryEditJob(job.job_id))}>
            {t.retry}
          </Button>
        </>
      )}

      {job.status === "NEEDS_CLARIFICATION" && (
        <p className="text-muted-foreground">
          {t.needsClarification}
        </p>
      )}

      {editorUrl && (
        <p className="text-[11px] text-muted-foreground">
          {t.editorLink} <a className="underline" href={editorUrl} target="_blank" rel="noopener noreferrer">{editorUrl}</a>
        </p>
      )}
    </div>
  );
}

function ReviseBox({
  text, setText, disabled, onSubmit, t,
}: {
  text: string; setText: (v: string) => void; disabled: boolean; onSubmit: () => void; t: (typeof T)[Lang];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.revisePlaceholder} />
      <Button size="sm" variant="outline" className="w-fit" disabled={disabled || !text.trim()} onClick={onSubmit}>
        {t.send}
      </Button>
    </div>
  );
}
