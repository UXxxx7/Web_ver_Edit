"use client";

// Third home-dashboard widget from the DataCamp/HeyGen reference pass (see
// #10/#11) — video jobs (Agent/Editor work) were previously invisible from
// "/", only reachable via /agent's own chat scrollback or the standalone
// /editor picker. Same data source as EditorPicker.tsx (lib/recent-jobs.ts's
// client-side localStorage list — apps/api still has no GET /jobs
// list-by-user endpoint, see that file's own header for why) and the same
// "click opens the manual editor" behavior, just surfaced on the page a
// new session actually lands on first.
import { useEffect, useState } from "react";
import { getEditJobStatus, getEditorUrl } from "@/app/(app)/agent/actions";
import { basename, type EditJob, type JobStatus } from "@/lib/edit-jobs";
import { getRecentJobs } from "@/lib/recent-jobs";
import type { Lang } from "@/lib/i18n";

const MAX_SHOWN = 6;

type Bucket = "progress" | "action" | "ready" | "error";

function bucketOf(status: JobStatus): Bucket {
  if (status === "ERROR") return "error";
  if (status === "DONE" || status === "PREVIEW_READY" || status === "CLIPS_READY") return "ready";
  if (status === "WAITING_CONFIRMATION" || status === "NEEDS_CLARIFICATION" || status === "NEEDS_TARGET_CHOICE") return "action";
  return "progress"; // RECEIVED, COLLECTING_ASSETS, DOWNLOADING_MEDIA, PLANNING, RUNNING_PIPELINE, RENDERING, DELIVERING
}

const BUCKET_LABEL: Record<Bucket, Record<Lang, string>> = {
  progress: { zh: "處理緊", en: "Processing" },
  action: { zh: "等緊你", en: "Needs input" },
  ready: { zh: "已完成", en: "Ready" },
  error: { zh: "出錯咗", en: "Error" },
};

const T = {
  zh: { heading: "你嘅最近作品", empty: null, untitled: "未命名任務", justNow: "啱啱", minAgo: (n: number) => `${n} 分鐘前`, hrAgo: (n: number) => `${n} 小時前`, dayAgo: (n: number) => `${n} 日前` },
  en: { heading: "Your recent work", empty: null, untitled: "Untitled job", justNow: "Just now", minAgo: (n: number) => `${n}m ago`, hrAgo: (n: number) => `${n}h ago`, dayAgo: (n: number) => `${n}d ago` },
} satisfies Record<Lang, { heading: string; empty: null; untitled: string; justNow: string; minAgo: (n: number) => string; hrAgo: (n: number) => string; dayAgo: (n: number) => string }>;

function relativeTime(iso: string | null, lang: Lang): string {
  if (!iso) return "";
  const t = T[lang];
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.hrAgo(hrs);
  return t.dayAgo(Math.floor(hrs / 24));
}

export function RecentWork({ lang }: { lang: Lang }) {
  const [jobs, setJobs] = useState<{ id: string; job: EditJob | null }[] | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    const ids = getRecentJobs().slice(0, MAX_SHOWN);
    Promise.all(
      ids.map(async (id) => {
        const r = await getEditJobStatus(id);
        return { id, job: r.ok ? r.data : null };
      })
    ).then(setJobs);
  }, []);

  const openJob = async (id: string) => {
    const result = await getEditorUrl(id);
    if (!result.ok) { setOpenError(result.error); return; }
    window.open(result.data.editorUrl, "_blank", "noopener,noreferrer");
  };

  // Nothing tracked yet, or every tracked id 404'd (another session's ids
  // in localStorage) — stay out of the way rather than show an empty
  // section; OnboardingChecklist's step 3 already covers "make your first
  // video" for a genuinely new user.
  if (jobs !== null && jobs.every((j) => j.job === null)) return null;

  return (
    <section className="recent-work">
      <div className="recent-work-head">
        <h2>{T[lang].heading}</h2>
      </div>
      <div className="recent-work-grid">
        {jobs === null && Array.from({ length: 3 }).map((_, i) => <div key={i} className="recent-work-card is-skeleton" />)}
        {jobs?.filter((j) => j.job !== null).map(({ id, job }) => (
          <RecentWorkCard key={id} id={id} job={job as EditJob} lang={lang} onOpen={() => openJob(id)} />
        ))}
      </div>
      {openError && <p className="recent-work-error">{openError}</p>}
    </section>
  );
}

function RecentWorkCard({ id, job, lang, onOpen }: { id: string; job: EditJob; lang: Lang; onOpen: () => void }) {
  // Falls back to the placeholder icon if the video 404s or otherwise
  // fails to load — hit this for real during testing (a stale DB row
  // whose job_dir had been cleaned up off disk); without this, a missing
  // file just rendered as an empty gray box instead of the placeholder
  // the "no media yet" case already shows.
  const [mediaFailed, setMediaFailed] = useState(false);
  const bucket = bucketOf(job.status);
  const mediaPath = job.final_path || job.preview_path;
  const mediaName = !mediaFailed ? basename(mediaPath) : null;
  const title = job.planned_edit?.summary?.split("\n")[0] || job.edit_request || T[lang].untitled;

  return (
    <button type="button" className="recent-work-card" onClick={onOpen}>
      <span className="recent-work-thumb">
        {mediaName ? (
          <video
            src={`/api/edit-files/${encodeURIComponent(id)}/${encodeURIComponent(mediaName)}`}
            preload="metadata"
            muted
            playsInline
            onError={() => setMediaFailed(true)}
            // Seek past a second once metadata's in so the poster frame is
            // real content, not the source's own intro fade-in — checked
            // against a real render, frame 0 was a solid color card, frame
            // ~2s was the actual talking-head shot. Fixed offset, not a
            // duration-based fraction: `duration` can still read Infinity
            // right when loadedmetadata first fires (confirmed live — by
            // the time the video's fully buffered a fraction would've been
            // fine, but this event fires earlier than that). The browser
            // clamps currentTime to the real duration on its own, so a
            // fixed 1s is safe even for clips shorter than that.
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = 1;
            }}
          />
        ) : (
          <span className="recent-work-thumb-placeholder" aria-hidden>🎬</span>
        )}
        <span className={`recent-work-status recent-work-status-${bucket}`}>{BUCKET_LABEL[bucket][lang]}</span>
      </span>
      <span className="recent-work-title">{title}</span>
      <span className="recent-work-time">{relativeTime(job.created_at, lang)}</span>
    </button>
  );
}
