"use client";

import { useRef, useState } from "react";
import { generateContentAction } from "@/app/(app)/actions";
import { createCrollJob, createEditJob, getEditJobStatus } from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JobProgress } from "@/components/JobProgress";
import { EDIT_SUGGESTIONS } from "@/lib/edit-suggestions";
import { getSuggestions } from "@/lib/suggestions";
import type { EditJob } from "@/lib/edit-jobs";
import type { VideoScriptResult } from "@/lib/generation-types";
import type { Lang } from "@/lib/i18n";

const CJK_RE = /[一-鿿㐀-䶿]/;

export type FlowKind = "photo" | "video";

const DICT = {
  zh: {
    back: "← 返去揀",
    stepLabels: ["攞靈感", "上載", "出片"],
    photo: {
      step1Title: "想個數碼人講咩？",
      step1Sub: "揀個建議，或者自己打個方向 — AI會幫你寫劇本。",
      placeholder: "畀個方向…",
      generate: "產生劇本",
      generating: "產生緊…",
      useScript: "用呢個劇本，繼續 →",
      skip: "唔使，直接跳過 →",
      step2Title: "上載一張相",
      photoLabel: "相片",
      photoHint: "一張清晰嘅正面相 — HeyGen 會將佢變做識講嘢嘅數碼人。",
      hintLabel: "方向 / 劇本",
      submit: "生成片",
      submitting: "生成緊…",
    },
    video: {
      step1Title: "想點樣剪？",
      step1Sub: "撳幾個建議砌返個剪接要求，或者自己打。",
      textareaPh: "例如：剪走贅字，加繁體字幕…",
      continue: "繼續 →",
      needText: "至少揀一個或者打幾隻字。",
      step2Title: "上載一段片",
      videoLabel: "影片",
      editRequestLabel: "想點樣剪？",
      submit: "上載同開始",
      submitting: "上載緊…",
    },
  },
  en: {
    back: "← Back to choices",
    stepLabels: ["Get inspiration", "Upload", "Produce"],
    photo: {
      step1Title: "What should the digital human say?",
      step1Sub: "Pick a suggestion, or type your own direction — AI writes the script.",
      placeholder: "Give a direction…",
      generate: "Generate script",
      generating: "Generating…",
      useScript: "Use this script, continue →",
      skip: "Skip, continue without →",
      step2Title: "Upload a photo",
      photoLabel: "Photo",
      photoHint: "A clear front-facing photo — HeyGen animates it into a talking digital human.",
      hintLabel: "Direction / script",
      submit: "Generate video",
      submitting: "Generating…",
    },
    video: {
      step1Title: "How should it be edited?",
      step1Sub: "Click a few presets to build your edit request, or type your own.",
      textareaPh: "e.g. remove filler words, burn in captions…",
      continue: "Continue →",
      needText: "Pick at least one, or type something.",
      step2Title: "Upload a video",
      videoLabel: "Video",
      editRequestLabel: "How should it be edited?",
      submit: "Upload & start",
      submitting: "Uploading…",
    },
  },
} satisfies Record<Lang, unknown>;

export function GuidedFlow({
  kind, lang, profileRole, onBack,
}: {
  kind: FlowKind;
  lang: Lang;
  profileRole: string;
  onBack: () => void;
}) {
  const t = DICT[lang];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [carriedText, setCarriedText] = useState("");
  const [job, setJob] = useState<EditJob | null>(null);

  if (step === 3 && job) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <JobProgress
          job={job}
          onUpdate={setJob}
          onReset={() => {
            setJob(null);
            setCarriedText("");
            setStep(1);
          }}
          lang={lang}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t.back}
        </button>
        <StepIndicator step={step} labels={t.stepLabels} />
      </div>

      {step === 1 && kind === "photo" && (
        <ScriptStep profileRole={profileRole} t={t.photo} onContinue={(text) => { setCarriedText(text); setStep(2); }} />
      )}
      {step === 1 && kind === "video" && (
        <EditInstructionStep lang={lang} t={t.video} onContinue={(text) => { setCarriedText(text); setStep(2); }} />
      )}
      {step === 2 && kind === "photo" && (
        <PhotoUploadStep t={t.photo} initialHint={carriedText} onJobCreated={(j) => { setJob(j); setStep(3); }} />
      )}
      {step === 2 && kind === "video" && (
        <VideoUploadStep t={t.video} initialEditRequest={carriedText} onJobCreated={(j) => { setJob(j); setStep(3); }} />
      )}
    </div>
  );
}

function StepIndicator({ step, labels }: { step: 1 | 2 | 3; labels: string[] }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
      {labels.map((label, i) => (
        <span key={label} className={i + 1 === step ? "font-bold text-primary" : ""}>
          {i + 1}. {label}
          {i < labels.length - 1 && <span className="mx-1.5 text-border">/</span>}
        </span>
      ))}
    </div>
  );
}

function ScriptStep({
  profileRole, t, onContinue,
}: {
  profileRole: string;
  t: typeof DICT["en"]["photo"];
  onContinue: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [script, setScript] = useState<VideoScriptResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = getSuggestions(profileRole);

  async function generate() {
    if (!value.trim()) return;
    setPending(true);
    setError(null);
    const genLang: "zh" | "en" = CJK_RE.test(value) ? "zh" : "en";
    const outcome = await generateContentAction("video_script", value, genLang);
    setPending(false);
    if ("error" in outcome) {
      setError(outcome.error);
      return;
    }
    setScript(outcome.result as VideoScriptResult);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t.step1Title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.step1Sub}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setValue((v) => (v.trim() ? `${v.trim()} ${s.text}` : s.text)); inputRef.current?.focus(); }}
              className="rounded-full border border-border bg-transparent px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t.placeholder} className="h-11" />
          <Button onClick={generate} disabled={pending || !value.trim()} className="h-11 shrink-0">
            {pending ? t.generating : t.generate}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {script && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Textarea rows={5} value={script.script} onChange={(e) => setScript({ ...script, script: e.target.value })} />
            <Button onClick={() => onContinue(script.script)} className="w-fit">{t.useScript}</Button>
          </div>
        )}

        {!script && (
          <button onClick={() => onContinue("")} className="w-fit text-sm text-muted-foreground hover:text-foreground">
            {t.skip}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function EditInstructionStep({
  lang, t, onContinue,
}: {
  lang: Lang;
  t: typeof DICT["en"]["video"];
  onContinue: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [showHint, setShowHint] = useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t.step1Title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.step1Sub}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EDIT_SUGGESTIONS[lang].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setValue((v) => (v.trim() ? `${v.trim()}，${s.text}` : s.text))}
              className="rounded-full border border-border bg-transparent px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </div>

        <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t.textareaPh} />

        {showHint && !value.trim() && <p className="text-sm text-destructive">{t.needText}</p>}

        <Button
          className="w-fit"
          onClick={() => {
            if (!value.trim()) { setShowHint(true); return; }
            onContinue(value.trim());
          }}
        >
          {t.continue}
        </Button>
      </CardContent>
    </Card>
  );
}

function PhotoUploadStep({
  t, initialHint, onJobCreated,
}: {
  t: typeof DICT["en"]["photo"];
  initialHint: string;
  onJobCreated: (job: EditJob) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createCrollJob(formData);
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) onJobCreated(status.data);
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleGenerate(fd)} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t.step2Title}</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="photo">{t.photoLabel}</label>
            <input
              id="photo" name="photo" type="file" accept="image/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">{t.photoHint}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="hint">{t.hintLabel}</label>
            <Input id="hint" name="hint" defaultValue={initialHint} />
          </div>
          <input type="hidden" name="lang" value="zh" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? t.submitting : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VideoUploadStep({
  t, initialEditRequest, onJobCreated,
}: {
  t: typeof DICT["en"]["video"];
  initialEditRequest: string;
  onJobCreated: (job: EditJob) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createEditJob(formData);
    setPending(false);
    if (!result.ok) { setError(result.error); return; }
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) onJobCreated(status.data);
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleUpload(fd)} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t.step2Title}</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="video">{t.videoLabel}</label>
            <input
              id="video" name="video" type="file" accept="video/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="edit_request">{t.editRequestLabel}</label>
            <Textarea id="edit_request" name="edit_request" rows={3} required defaultValue={initialEditRequest} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? t.submitting : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
