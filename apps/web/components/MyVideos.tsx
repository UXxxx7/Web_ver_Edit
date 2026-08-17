"use client";

// The account-level save area: every video that finished rendering in
// Agent lands here (GET /users/{id}/videos → apps/api's
// job_manager.list_done_jobs_for_user), independent of which browser/
// device you're on. Editing is a deliberate opt-in from here — click
// "Edit" (or select several and "Add to editor") to send a video to the
// Editor page's work queue (lib/editor-queue.ts); Editor no longer
// auto-lists every job on its own, which used to duplicate this list.
// Editing re-renders the SAME job in place (apps/api's manual editor has
// no multi-clip merge), so the updated result reappears right here, in
// the same card, next time this list is fetched — not as a new entry.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyVideosAction } from "@/app/(app)/agent/actions";
import { addToEditorQueue } from "@/lib/editor-queue";
import { basename, type SavedVideo } from "@/lib/edit-jobs";

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex-1 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50"
    >
      {copied ? "已複製連結" : "分享"}
    </button>
  );
}

export function MyVideos() {
  const router = useRouter();
  const [videos, setVideos] = useState<SavedVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMyVideosAction().then((result) => {
      if (result.ok) setVideos(result.data);
      else setError(result.error);
    });
  }, []);

  function toggleSelected(jobId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function editOne(jobId: string) {
    addToEditorQueue(jobId);
    router.push("/editor");
  }

  function editSelected() {
    selected.forEach((jobId) => addToEditorQueue(jobId));
    router.push("/editor");
  }

  if (videos === null) {
    return (
      <div className="px-4 py-16 text-center text-[13.5px] text-muted-foreground sm:px-8">
        {error ? error : "載入緊…"}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
          <h2 className="text-lg font-bold text-foreground">仲未有片</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            上載一條片同AI講點剪，完成之後會自動喺呢度出現。
          </p>
          <a
            href="/agent"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-[13.5px] font-semibold text-background transition-transform hover:-translate-y-px"
          >
            去Agent剪片
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 pb-24 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">我的影片</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">已經完成嘅片，可以隨時下載、分享，或者揀返去編輯器再調整。</p>
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={editSelected}
              className="rounded-lg bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-transform hover:-translate-y-px"
            >
              加入編輯器（{selected.size}）
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => {
            const url = fileUrl(video.job_id, video.final_path);
            const isSelected = selected.has(video.job_id);
            return (
              <div
                key={video.job_id}
                className={`overflow-hidden rounded-2xl border bg-card shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-colors ${
                  isSelected ? "border-primary" : "border-border"
                }`}
              >
                <div className="relative">
                  {url && <video controls src={url} className="aspect-[9/16] w-full bg-black object-cover" />}
                  <button
                    type="button"
                    onClick={() => toggleSelected(video.job_id)}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? "取消選取" : "選取"}
                    className={`absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/70 bg-black/30 text-transparent hover:border-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5 10 17l9-10" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 text-[13px] leading-snug text-foreground">{video.edit_request}</p>
                  <div className="mt-3 flex gap-2">
                    {url && (
                      <a
                        href={url}
                        download
                        className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-center text-[12.5px] font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
                      >
                        下載
                      </a>
                    )}
                    {url && <ShareButton url={url} />}
                    <button
                      type="button"
                      onClick={() => editOne(video.job_id)}
                      className="flex-1 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/50"
                    >
                      編輯
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
