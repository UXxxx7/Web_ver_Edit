"use client";

import { useState } from "react";
import { createCrollJob, getEditJobStatus } from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JobProgress } from "@/components/JobProgress";
import type { EditJob } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    photo: "相片",
    photoHint: "一張清晰嘅正面相 — HeyGen 會將佢變做識講嘢嘅數碼人。",
    direction: "方向（隨意）",
    directionPh: "例如：介紹自願醫保新政策",
    generating: "生成緊…",
    submit: "生成 C-roll",
    footer: "AI 會根據你嘅相/方向寫劇本，HeyGen 生成識講嘢嘅片（大約1-2分鐘），跟住就會用返同上載影片一樣嘅剪接流程。",
  },
  en: {
    photo: "Photo",
    photoHint: "A clear front-facing photo — HeyGen animates it into a talking digital human.",
    direction: "Direction (optional)",
    directionPh: "e.g. 介紹自願醫保新政策",
    generating: "Generating…",
    submit: "Generate C-roll",
    footer: "AI writes the script from your photo/direction, HeyGen generates the talking video (~1-2 min), then it goes through the same edit pipeline as an uploaded video.",
  },
} satisfies Record<Lang, unknown>;

export function CrollCreator({ lang }: { lang: Lang }) {
  const [job, setJob] = useState<EditJob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const t = DICT[lang];

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
    return <JobProgress job={job} onUpdate={setJob} onReset={() => setJob(null)} lang={lang} />;
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleGenerate(fd)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="photo">{t.photo}</label>
            <input
              id="photo" name="photo" type="file" accept="image/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">{t.photoHint}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="hint">{t.direction}</label>
            <Input id="hint" name="hint" placeholder={t.directionPh} />
          </div>
          <input type="hidden" name="lang" value="zh" />
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          <Button type="submit" disabled={uploading} className="w-fit">
            {uploading ? t.generating : t.submit}
          </Button>
          <p className="text-xs text-muted-foreground">{t.footer}</p>
        </form>
      </CardContent>
    </Card>
  );
}
