"use client";

import { useState } from "react";
import { GuidedFlow, type FlowKind } from "@/components/GuidedFlow";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    kicker: "揀個開始 — 唔使拍片，唔使剪接",
    heading: "由一張相，或者一段片，出到一條finish片。",
    photoTitle: "相片 → 影片",
    photoBody: "上載一張相，AI幫你寫劇本、生成識講嘢嘅數碼人，加埋配音同字幕。",
    videoTitle: "影片 → AI剪接",
    videoBody: "上載你自己嘅片，AI幫你剪走贅字、加字幕、裁做直度。",
  },
  en: {
    kicker: "Pick a starting point — no filming, no editing",
    heading: "From one photo, or one video, to a finished clip.",
    photoTitle: "Photo → Video",
    photoBody: "Upload a photo — AI writes the script, generates a talking digital human, adds voiceover and captions.",
    videoTitle: "Video → AI edit",
    videoBody: "Upload your own footage — AI removes filler words, adds captions, reframes to 9:16.",
  },
} satisfies Record<Lang, unknown>;

export function DashboardHome({ profileRole, lang }: { profileRole: string; lang: Lang }) {
  const [flow, setFlow] = useState<FlowKind | null>(null);
  const t = DICT[lang];

  if (flow) {
    return <GuidedFlow kind={flow} lang={lang} profileRole={profileRole} onBack={() => setFlow(null)} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
      <p className="font-mono text-[11.5px] font-semibold uppercase tracking-wide text-primary">{t.kicker}</p>
      <h1 className="mx-auto mt-3 max-w-lg text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t.heading}</h1>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FlowCard
          icon="🖼️"
          title={t.photoTitle}
          body={t.photoBody}
          onClick={() => setFlow("photo")}
        />
        <FlowCard
          icon="🎬"
          title={t.videoTitle}
          body={t.videoBody}
          onClick={() => setFlow("video")}
        />
      </div>
    </div>
  );
}

function FlowCard({
  icon, title, body, onClick,
}: {
  icon: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-colors hover:border-primary/50"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">{icon}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </button>
  );
}
