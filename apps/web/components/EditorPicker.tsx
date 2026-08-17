"use client";

// Standalone entry point for the manual editor (remotion-composer/editor/,
// ported unchanged — see apps/api/app/main.py). Previously only reachable
// via a link buried inside a chat bubble; this is the top-level "Editor"
// nav destination the user asked for instead.
import { useEffect, useState } from "react";
import { getEditJobStatus, getEditorUrl } from "@/app/(app)/agent/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEditorQueue, removeFromEditorQueue } from "@/lib/editor-queue";
import { getRecentJobs } from "@/lib/recent-jobs";
import type { EditJob } from "@/lib/edit-jobs";

async function openEditorFor(jobId: string, setError: (e: string | null) => void) {
  const result = await getEditorUrl(jobId);
  if (!result.ok) {
    setError(result.error);
    return;
  }
  window.open(result.data.editorUrl, "_blank", "noopener,noreferrer");
}

export function EditorPicker() {
  const [jobs, setJobs] = useState<{ id: string; job: EditJob | null }[] | null>(null);
  const [queue, setQueue] = useState<{ id: string; job: EditJob | null }[] | null>(null);
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Promise.all([]) resolves to [] on the microtask queue, so the empty
    // case also sets state asynchronously — avoids a synchronous setState in
    // the effect body (eslint react-hooks/set-state-in-effect).
    Promise.all(
      getRecentJobs().map(async (id) => {
        const r = await getEditJobStatus(id);
        return { id, job: r.ok ? r.data : null };
      })
    ).then(setJobs);
    Promise.all(
      getEditorQueue().map(async (id) => {
        const r = await getEditJobStatus(id);
        return { id, job: r.ok ? r.data : null };
      })
    ).then(setQueue);
  }, []);

  const removeQueued = (id: string) => {
    removeFromEditorQueue(id);
    setQueue((q) => q?.filter((item) => item.id !== id) ?? null);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The manual props/timeline editor — opens in a new tab, one video at a time. Pick a job below, from
          anything you&apos;ve created in Agent on this browser, or paste a job id directly.
        </p>
      </div>

      {queue !== null && queue.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-1 text-sm font-semibold">已加入編輯 ({queue.length})</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            由「我的影片」加入嘅片。呢個manual editor每次淨係可以開一條片——想合併多條片，要等呢個功能出咗先。
          </p>
          <div className="flex flex-col gap-2">
            {queue.map(({ id, job }) => (
              <Card key={id}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-muted-foreground">{id}</p>
                    <p className="truncate text-sm">
                      {job ? `${job.status} · ${job.edit_request || job.pipeline}` : "Not found (may belong to another session)"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditorFor(id, setError)}>
                      Open editor
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeQueued(id)}>
                      移除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Open by job id</h3>
          <div className="flex gap-2">
            <Input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="job_xxxxxxxxxxxx"
              className="font-mono text-xs"
            />
            <Button disabled={!manualId.trim()} onClick={() => openEditorFor(manualId.trim(), setError)}>
              Open
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <h3 className="mb-3 text-sm font-semibold">Recent jobs (this browser)</h3>
      {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {jobs?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No jobs created here yet — go to <a href="/agent" className="underline">Agent</a> and upload a
          video or photo first.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {jobs?.map(({ id, job }) => (
          <Card key={id}>
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{id}</p>
                <p className="text-sm">
                  {job ? `${job.status} · ${job.edit_request || job.pipeline}` : "Not found (may belong to another session)"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEditorFor(id, setError)}>
                Open editor
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
