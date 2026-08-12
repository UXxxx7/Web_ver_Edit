"use client";

import { useState } from "react";
import { createEditJob, getEditJobStatus } from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { JobProgress } from "@/components/JobProgress";
import type { EditJob } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    video: "影片",
    editRequest: "想點樣剪？",
    editRequestPh: "例如：剪掉空白位，加繁體字幕 / remove filler words and burn in captions",
    uploading: "上載緊…",
    submit: "上載同開始",
  },
  en: {
    video: "Video",
    editRequest: "How should it be edited?",
    editRequestPh: "e.g. 剪掉空白位，加繁體字幕 / remove filler words and burn in captions",
    uploading: "Uploading…",
    submit: "Upload & start",
  },
} satisfies Record<Lang, unknown>;

export function VideoEditor({ lang }: { lang: Lang }) {
  const [job, setJob] = useState<EditJob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const t = DICT[lang];

  async function handleUpload(formData: FormData) {
    setUploadError(null);
    setUploading(true);
    const result = await createEditJob(formData);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) setJob(status.data);
  }

  if (job) {
    return <JobProgress job={job} onUpdate={setJob} onReset={() => setJob(null)} lang={lang} />;
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleUpload(fd)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="video">{t.video}</label>
            <input
              id="video" name="video" type="file" accept="video/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="edit_request">{t.editRequest}</label>
            <Textarea
              id="edit_request" name="edit_request" rows={3} required
              placeholder={t.editRequestPh}
            />
          </div>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          <Button type="submit" disabled={uploading} className="w-fit">
            {uploading ? t.uploading : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
