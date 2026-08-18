"use client";

// "Share to Community" — AI drafts a caption from the video's real
// transcript (not the edit_request or planned_edit.summary — see
// prepareCaptionFromJobAction's own header for why), shown editable, never
// auto-posted. Self-contained state machine (idle -> loading ->
// editing/posting -> done) — nothing above this needs to know a share
// happened. Originally lived inline in AgentJobBubble.tsx; pulled out here
// once MyVideos.tsx needed the exact same "pick this job -> post it to
// Community" flow, rather than a second copy drifting out of sync.
import { useState } from "react";
import { createPostAction, prepareCaptionFromJobAction } from "@/app/(app)/community/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Lang } from "@/lib/i18n";

const T = {
  zh: {
    sharedDone: "已經分享咗去社群！", viewIt: "去睇吓",
    postToCommunity: "分享去社群", posting: "分享緊…", cancel: "取消", summarizing: "總結緊…",
  },
  en: {
    sharedDone: "Shared to Community!", viewIt: "View it",
    postToCommunity: "Post to Community", posting: "Posting…", cancel: "Cancel", summarizing: "Summarizing…",
  },
} satisfies Record<Lang, {
  sharedDone: string; viewIt: string; postToCommunity: string; posting: string; cancel: string; summarizing: string;
}>;

export function ShareToCommunityPanel({ jobId, lang }: { jobId: string; lang: Lang }) {
  const t = T[lang];
  const [state, setState] = useState<"idle" | "loading" | "editing" | "posting" | "done">("idle");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function start() {
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
    setState("editing");
  }

  async function confirmPost() {
    setError(null);
    setState("posting");
    const result = await createPostAction(jobId, caption);
    if (!result.ok) {
      setError(result.error);
      setState("editing");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <p className="text-[13px]">
        {t.sharedDone} <a href="/community" className="text-primary underline">{t.viewIt}</a>
      </p>
    );
  }

  if (state === "editing" || state === "posting") {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          rows={4}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={state === "posting"}
        />
        {error && <p className="text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={state === "posting" || !caption.trim()} onClick={confirmPost}>
            {state === "posting" ? t.posting : t.postToCommunity}
          </Button>
          <Button size="sm" variant="ghost" disabled={state === "posting"} onClick={() => setState("idle")}>
            {t.cancel}
          </Button>
        </div>
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
        onClick={start}
      >
        {state === "loading" ? (
          <>
            <span className="dash-spinner" />
            {t.summarizing}
          </>
        ) : (
          t.postToCommunity
        )}
      </Button>
    </>
  );
}
