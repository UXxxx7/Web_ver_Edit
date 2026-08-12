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
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = getRecentJobs();
    if (ids.length === 0) {
      setJobs([]);
      return;
    }
    Promise.all(
      ids.map(async (id) => {
        const r = await getEditJobStatus(id);
        return { id, job: r.ok ? r.data : null };
      })
    ).then(setJobs);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The manual props/timeline editor — opens in a new tab. Pick a job below, from anything you&apos;ve
          created in Agent on this browser, or paste a job id directly.
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
