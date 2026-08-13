"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOnboardingStatusAction } from "@/app/(app)/actions";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    heading: "完善你嘅帳戶",
    subheading: (n: number) => `${n}/4 完成 — 幫你發現晒呢個平台可以做啲乜`,
    steps: [
      { title: "填好你嘅資料", caption: "行業同品牌語氣，等 AI 生成更貼合你", cta: "去填資料", href: "/profile" },
      { title: "生成你嘅第一份文案", caption: "揀返上面一個場景卡，或者自己打個方向", cta: "睇返上面", href: "#scenario-gallery" },
      { title: "剪出你嘅第一條片", caption: "上載一條片，AI 幫你剪同加字幕", cta: "去 Agent", href: "/agent" },
      { title: "試吓聲音克隆", caption: "克隆你把聲，之後啲片自動用返你把聲", cta: "去試吓", href: "/agent" },
    ],
  },
  en: {
    heading: "Finish setting up",
    subheading: (n: number) => `${n}/4 done — a quick way to see what's here`,
    steps: [
      { title: "Fill in your profile", caption: "Industry + brand voice — helps AI output match you", cta: "Go to profile", href: "/profile" },
      { title: "Generate your first idea", caption: "Pick a scenario card above, or type your own direction", cta: "See above", href: "#scenario-gallery" },
      { title: "Make your first video edit", caption: "Upload a video — AI edits and adds captions", cta: "Go to Agent", href: "/agent" },
      { title: "Try voice cloning", caption: "Clone your voice, reuse it in future videos automatically", cta: "Try it", href: "/agent" },
    ],
  },
} satisfies Record<Lang, { heading: string; subheading: (n: number) => string; steps: { title: string; caption: string; cta: string; href: string }[] }>;

export function OnboardingChecklist({
  lang, profileComplete, hasGeneration,
}: {
  lang: Lang;
  profileComplete: boolean;
  hasGeneration: boolean; // already know this from the history apps/web already fetched — no need to round-trip apps/api for it
}) {
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
  if (doneCount === 4) return null;

  const t = DICT[lang];

  return (
    <section className="onboarding-checklist">
      <div className="onboarding-head">
        <h2>{t.heading}</h2>
        <p>{t.subheading(doneCount)}</p>
        <div className="onboarding-progress" aria-hidden>
          {done.map((d, i) => (
            <span key={i} className={`onboarding-progress-seg${d ? " is-done" : ""}`} />
          ))}
        </div>
      </div>
      <div className="onboarding-steps">
        {t.steps.map((step, i) => (
          <div key={step.title} className={`onboarding-step${done[i] ? " is-done" : ""}`}>
            <span className="onboarding-step-check" aria-hidden>
              {done[i] ? "✓" : i + 1}
            </span>
            <span className="onboarding-step-body">
              <span className="onboarding-step-title">{step.title}</span>
              <span className="onboarding-step-caption">{step.caption}</span>
            </span>
            {!done[i] && (
              <Link href={step.href} className="onboarding-step-cta">
                {step.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
