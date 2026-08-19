"use client";

// New-user progress nudge on the home dashboard — re-integrated after the
// #19 dashboard redesign replaced the component tree this was originally
// built into (FeatureHub/TemplateGallery instead of the old ScenarioGallery
// this shipped alongside). Visual language matches FeatureHub/TemplateGallery
// (rounded-2xl cards, hand-drawn SVG line icons, color-mix accent chips) —
// not the older --dash-* custom CSS this component used before, so it reads
// as part of the same redesigned surface rather than a leftover from the
// previous look.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getOnboardingStatusAction } from "@/app/(app)/actions";
import type { Lang } from "@/lib/i18n";

const ICONS = {
  profile: <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />,
  script: <path d="M5 4.5h9l5 5V19a.5.5 0 0 1-.5.5H5A.5.5 0 0 1 4.5 19V5A.5.5 0 0 1 5 4.5Z M14 4.5V9h4.5 M8 13h8M8 16h5" />,
  videoEdit: <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3 M8 9.5l1.6 1.6L8 12.7" />,
  voice: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6" />,
};

const STEPS: Record<Lang, { icon: React.ReactNode; color: string; title: string; caption: string; cta: string; href: string }[]> = {
  zh: [
    { icon: ICONS.profile, color: "#3E63FF", title: "填好你嘅資料", caption: "行業同品牌語氣，等 AI 生成更貼合你", cta: "去填資料", href: "/profile" },
    { icon: ICONS.script, color: "#8B5CF6", title: "生成你嘅第一份文案", caption: "揸下面嘅範本，或者自己打個方向", cta: "睇返下面", href: "#brainstorm" },
    { icon: ICONS.videoEdit, color: "#22C55E", title: "剪出你嘅第一條片", caption: "上載一條片，AI 幫你剪同加字幕", cta: "去 Agent", href: "/agent" },
    { icon: ICONS.voice, color: "#F59E0B", title: "試吓聲音克隆", caption: "克隆你把聲，之後啲片自動用返你把聲", cta: "去試吓", href: "/agent" },
  ],
  en: [
    { icon: ICONS.profile, color: "#3E63FF", title: "Fill in your profile", caption: "Industry and brand voice, so AI generates content that fits you", cta: "Fill it in", href: "/profile" },
    { icon: ICONS.script, color: "#8B5CF6", title: "Generate your first draft", caption: "Pick a template below, or type your own direction", cta: "See below", href: "#brainstorm" },
    { icon: ICONS.videoEdit, color: "#22C55E", title: "Edit your first video", caption: "Upload a video — AI trims it and adds captions", cta: "Go to Agent", href: "/agent" },
    { icon: ICONS.voice, color: "#F59E0B", title: "Try voice cloning", caption: "Clone your voice — future clips automatically use it", cta: "Try it", href: "/agent" },
  ],
};

const T = {
  zh: { heading: "完善你嘅帳戶", complete: "完成" },
  en: { heading: "Complete your account", complete: "complete" },
} satisfies Record<Lang, { heading: string; complete: string }>;

export function OnboardingChecklist({
  profileComplete, hasGeneration, lang,
}: {
  profileComplete: boolean;
  hasGeneration: boolean; // already known from history apps/web already fetched — no need to round-trip apps/api for it
  lang: Lang;
}) {
  const t = T[lang];
  const steps = STEPS[lang];
  // job_count/voice_cloned live in apps/api (SQLite), not apps/web's own
  // profile/generations store — fetched client-side after mount rather
  // than blocking the whole dashboard's server render on a second
  // service being up. Starts as "not done" and fills in once it resolves;
  // fails soft (see getOnboardingStatusAction), never shows an error state.
  const [apiStatus, setApiStatus] = useState<{ jobCount: number; voiceCloned: boolean } | null>(null);

  useEffect(() => {
    getOnboardingStatusAction().then(({ jobCount, voiceCloned }) => setApiStatus({ jobCount, voiceCloned }));
  }, []);

  const done = [profileComplete, hasGeneration, Boolean(apiStatus && apiStatus.jobCount > 0), Boolean(apiStatus?.voiceCloned)];
  const doneCount = done.filter(Boolean).length;

  // Fully onboarded — get out of the way rather than nag forever.
  if (doneCount === steps.length) return null;

  return (
    <div className="border-b border-border px-4 py-7 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">{t.heading}</h2>
          <span className="text-[12px] text-muted-foreground">{doneCount}/{steps.length} {t.complete}</span>
        </div>
        <div className="mb-4 flex gap-1.5">
          {done.map((d, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${d ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className={`flex items-start gap-2.5 rounded-2xl border border-border bg-card p-3.5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-opacity ${done[i] ? "opacity-55" : ""}`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: `color-mix(in srgb, ${step.color} 14%, transparent)`, color: step.color }}
              >
                {done[i] ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {step.icon}
                  </svg>
                )}
              </span>
              <div className="min-w-0">
                <h3 className="text-[12.5px] font-semibold text-foreground">{step.title}</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{step.caption}</p>
                {!done[i] && (
                  <Link href={step.href} className="mt-1.5 inline-block text-[11px] font-semibold text-primary hover:underline">
                    {step.cta} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
