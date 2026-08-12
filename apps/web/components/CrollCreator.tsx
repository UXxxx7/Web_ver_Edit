"use client";

import { useState } from "react";
import { createCrollJob, getEditJobStatus } from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JobProgress } from "@/components/JobProgress";
import type { EditJob } from "@/lib/edit-jobs";

export function CrollCreator() {
  const [job, setJob] = useState<EditJob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleGenerate(formData: FormData) {
    setUploadError(null);
    setUploading(true);
    const result = await createCrollJob(formData);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) setJob(status.data);
  }

  if (job) {
    return <JobProgress job={job} onUpdate={setJob} onReset={() => setJob(null)} />;
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleGenerate(fd)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="photo">Photo</label>
            <input
              id="photo" name="photo" type="file" accept="image/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">
              A clear front-facing photo — HeyGen animates it into a talking digital human.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="hint">Direction (optional)</label>
            <Input id="hint" name="hint" placeholder="e.g. 介紹自願醫保新政策" />
          </div>
          <input type="hidden" name="lang" value="zh" />
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          <Button type="submit" disabled={uploading} className="w-fit">
            {uploading ? "Generating…" : "Generate C-roll"}
          </Button>
          <p className="text-xs text-muted-foreground">
            AI writes the script from your photo/direction, HeyGen generates the talking video (~1-2 min),
            then it goes through the same edit pipeline as an uploaded video.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
