"use client";

import { SCENARIOS, matchIndustry, scenarioDirection } from "@/lib/scenario-templates";
import { TOOL_META, type GenerationKind } from "@/lib/generation-types";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    heading: (industry: string | null) => (industry ? `為你嘅行業準備好嘅` : "快速開始"),
    subheading: "揀一個場景，AI 即刻幫你寫好——生成之後你隨時可以再改。",
    create: "生成",
    creating: "生成緊…",
  },
  en: {
    heading: (industry: string | null) => (industry ? "Picked for your industry" : "Quick start"),
    subheading: "Pick a scenario — AI drafts it right away, edit freely after.",
    create: "Create",
    creating: "Creating…",
  },
} satisfies Record<Lang, { heading: (i: string | null) => string; subheading: string; create: string; creating: string }>;

const INDUSTRY_LABEL: Record<string, Record<Lang, string>> = {
  insurance: { zh: "保險", en: "insurance" },
  real_estate: { zh: "地產", en: "real estate" },
  beauty: { zh: "美容", en: "beauty" },
  fitness: { zh: "健身", en: "fitness" },
  financial_planning: { zh: "財務策劃", en: "financial planning" },
};

export function ScenarioGallery({
  role,
  lang,
  pendingKinds,
  onFire,
}: {
  role: string;
  lang: Lang;
  pendingKinds: Set<GenerationKind>;
  onFire: (kind: GenerationKind, direction: string) => void;
}) {
  const t = DICT[lang];
  const industryKey = matchIndustry(role);
  const industryLabel = industryKey ? INDUSTRY_LABEL[industryKey][lang] : null;

  return (
    <section id="scenario-gallery" className="scenario-gallery">
      <div className="scenario-gallery-head">
        <h2>
          {t.heading(industryLabel)}
          {industryLabel && <span className="scenario-industry-pill">{industryLabel}</span>}
        </h2>
        <p>{t.subheading}</p>
      </div>
      <div className="scenario-grid">
        {SCENARIOS.map((s) => {
          const pending = pendingKinds.has(s.kind);
          const direction = scenarioDirection(s, role, lang);
          return (
            <button
              key={s.id}
              type="button"
              className="scenario-card"
              disabled={pending}
              onClick={() => onFire(s.kind, direction)}
            >
              <span className="scenario-card-icon" style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}>
                {s.icon}
              </span>
              <span className="scenario-card-body">
                <span className="scenario-card-title">{s.title[lang]}</span>
                <span className="scenario-card-caption">{s.caption[lang]}</span>
              </span>
              <span className="scenario-card-footer">
                <span className="scenario-card-kind">
                  {TOOL_META[s.kind].icon} {TOOL_META[s.kind].label}
                </span>
                <span className="scenario-card-cta">{pending ? t.creating : t.create}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
