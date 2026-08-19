"use client";

// Standalone "just give me a caption" button — same AI caption-drafting
// chain ShareToCommunityPanel.tsx uses (prepareCaptionFromJobAction:
// summarize the video's real transcript into a theme, then run that
// through the same /content-ideas generator the Dashboard's own caption
// tool calls), but decoupled from posting to this app's in-house
// Community feed. Requested specifically because not every caption is
// for Community — someone might want it to paste into a real
// Instagram/TikTok caption field, or just to have — and the existing
// panel's only exit was "post it here or don't get a caption at all".
// Ends at Copy, not Post; sibling component, not a mode flag on
// ShareToCommunityPanel, so each stays a single, focused state machine
// instead of one component branching on what happens after generation.
import { useState } from "react";
import { prepareCaptionFromJobAction } from "@/app/(app)/community/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Lang } from "@/lib/i18n";

const T = {
  zh: {
    generate: "自動生成文案", generating: "生成緊…", copy: "複製", copied: "已複製！",
  },
  en: {
    generate: "Auto-generate caption", generating: "Generating…", copy: "Copy", copied: "Copied!",
  },
} satisfies Record<Lang, { generate: string; generating: string; copy: string; copied: string }>;

export function GenerateCaptionButton({ jobId, lang }: { jobId: string; lang: Lang }) {
  const t = T[lang];
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setError(null);
    setState("loading");
    const result = await prepareCaptionFromJobAction(jobId);
    if (!result.ok) {
      setError(result.error);
      setState("idle");
      return;
    }
    const tags = result.data.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    setCaption(tags ? `${result.data.caption}\n\n${tags}` : result.data.caption);
    setState("ready");
  }

  function copy() {
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (state === "ready") {
    return (
      <div className="flex flex-col gap-2">
        <Textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <Button size="sm" variant="outline" className="w-fit" onClick={copy}>
          {copied ? t.copied : t.copy}
        </Button>
      </div>
    );
  }

  return (
    <>
      {error && <p className="text-destructive">{error}</p>}
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={state === "loading"}
        onClick={generate}
      >
        {state === "loading" ? (
          <>
            <span className="dash-spinner" />
            {t.generating}
          </>
        ) : (
          t.generate
        )}
      </Button>
    </>
  );
}
