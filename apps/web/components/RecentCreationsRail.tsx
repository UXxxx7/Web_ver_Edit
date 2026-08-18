"use client";

// Fills the dead space beside the Agent chat thread on wide screens with a
// glance at what you've already made — same account-level source as
// MyVideos.tsx (GET /users/{id}/videos), just capped to a handful and shown
// as a narrow rail instead of a full grid. Fetched once on mount, same as
// MyVideos.tsx's own load — not wired to refresh live when a job in this
// chat finishes, since that status lives inside AgentJobBubble's own
// polling, not here.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyVideosAction } from "@/app/(app)/agent/actions";
import { VideoPlayer } from "@/components/VideoPlayer";
import { basename, type SavedVideo } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

const MAX_SHOWN = 6;

const T = {
  zh: {
    heading: "最近作品",
    seeAll: "查看全部",
    emptyTitle: "仲未有作品",
    emptyBody: "喺呢度剪完嘅片會自動出現。",
    close: "關閉",
  },
  en: {
    heading: "Recent creations",
    seeAll: "See all",
    emptyTitle: "Nothing yet",
    emptyBody: "Videos you finish here show up automatically.",
    close: "Close",
  },
} satisfies Record<Lang, { heading: string; seeAll: string; emptyTitle: string; emptyBody: string; close: string }>;

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

export function RecentCreationsRail({ lang, className = "" }: { lang: Lang; className?: string }) {
  const t = T[lang];
  const [videos, setVideos] = useState<SavedVideo[] | null>(null);
  // Playing a clip opens it right here with data already in hand (the URL
  // was computed from the same fetch that drew the thumbnail) instead of
  // navigating to /videos, which used to re-fetch the whole account list
  // and re-render the full grid just to show the one clip already visible.
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getMyVideosAction().then((result) => {
      if (result.ok) setVideos(result.data);
    });
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const openVideo = videos?.find((v) => v.job_id === openId);
  const openUrl = openVideo ? fileUrl(openVideo.job_id, openVideo.final_path) : null;

  return (
    <aside className={`shrink-0 border-l border-border px-4 py-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-tight text-foreground">{t.heading}</h2>
        <Link href="/videos" className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          {t.seeAll}
        </Link>
      </div>

      {videos === null ? null : videos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-[12.5px] font-semibold text-foreground">{t.emptyTitle}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{t.emptyBody}</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {videos.slice(0, MAX_SHOWN).map((video) => {
            const url = fileUrl(video.job_id, video.final_path);
            return (
              <button
                key={video.job_id}
                type="button"
                onClick={() => setOpenId(video.job_id)}
                className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 text-left shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                {url && (
                  <video
                    src={url}
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-12 shrink-0 rounded-lg bg-black object-cover"
                  />
                )}
                <p className="line-clamp-3 text-[12px] leading-snug text-muted-foreground group-hover:text-foreground">
                  {video.edit_request}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {openUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setOpenId(null)}
        >
          <div className="w-full max-w-[300px]" onClick={(e) => e.stopPropagation()}>
            <VideoPlayer src={openUrl} className="w-full" />
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="mt-3 w-full rounded-lg border border-border bg-card py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
