"use client";

// Standalone entry point for the manual editor (remotion-composer/editor/,
// ported unchanged — see apps/api/app/main.py).
//
// Used to auto-list every job lib/recent-jobs.ts had ever seen on this
// browser (created, errored, revised — everything), which duplicated "My
// Videos"'s job of being *the* saved-videos list and cluttered this page
// with things nobody meant to edit. Per an explicit product decision, this
// is now a deliberately-curated queue instead: only videos someone clicked
// "Edit" on from a My Videos card land here (lib/editor-queue.ts), nothing
// shows up automatically just because it exists.
import { useEffect, useState } from "react";
import { getEditJobStatus, getEditorUrl } from "@/app/(app)/agent/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEditorQueue, removeFromEditorQueue } from "@/lib/editor-queue";
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
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    const ids = getEditorQueue();
    // Promise.all([]) resolves to [] on the microtask queue, so the empty
    // case also sets state asynchronously — avoids a synchronous setState in
    // the effect body (eslint react-hooks/set-state-in-effect).
    Promise.all(
      ids.map(async (id) => {
        const r = await getEditJobStatus(id);
        return { id, job: r.ok ? r.data : null };
      })
    ).then(setJobs);
  }

  useEffect(refresh, []);

  function removeOne(jobId: string) {
    removeFromEditorQueue(jobId);
    setJobs((prev) => (prev ? prev.filter((j) => j.id !== jobId) : prev));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The manual props/timeline editor — opens in a new tab. Videos you send here from{" "}
          <a href="/videos" className="underline">My Videos</a> (click &quot;Edit&quot; on one, or select several
          and &quot;Add to editor&quot;) show up below, or paste a job id directly.
        </p>
      </div>

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

      <h3 className="mb-3 text-sm font-semibold">Sent here for editing</h3>
      {jobs === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {jobs?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing here yet — go to <a href="/videos" className="underline">My Videos</a> and click
          &quot;Edit&quot; on a finished video.
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
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditorFor(id, setError)}>
                  Open editor
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeOne(id)}>
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
