"use client";

// Real feature, not a placeholder: apps/api has no GET /jobs (list-by-user)
// endpoint yet, so this reads the same client-side recent-jobs list
// AgentChat already writes to (lib/recent-jobs.ts), fetches each job's
// current status, and shows only the ones that finished rendering. Same
// fileUrl/basename pattern AgentJobBubble.tsx uses for its own preview —
// duplicated locally rather than importing a private helper from that file.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getEditJobStatus } from "@/app/(app)/agent/actions";
import { getRecentJobs } from "@/lib/recent-jobs";
import { basename, type EditJob } from "@/lib/edit-jobs";

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
  const [jobs, setJobs] = useState<EditJob[] | null>(null);

  useEffect(() => {
    const ids = getRecentJobs();
    // Promise.all([]) resolves immediately to [] — no need for a special
    // empty-list branch, which would otherwise call setState synchronously
    // in the effect body (react-hooks/set-state-in-effect).
    Promise.all(ids.map((id) => getEditJobStatus(id))).then((results) => {
      const done = results
        .filter((r) => r.ok && r.data.status === "DONE" && !!r.data.final_path)
        .map((r) => (r as { ok: true; data: EditJob }).data);
      setJobs(done);
    });
  }, []);

  if (jobs === null) {
    return <div className="px-4 py-16 text-center text-[13.5px] text-muted-foreground sm:px-8">載入緊…</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
          <h2 className="text-lg font-bold text-foreground">仲未有片</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            上載一條片同AI講點剪，完成之後會自動喺呢度出現。
          </p>
          <Link
            href="/agent"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2.5 text-[13.5px] font-semibold text-background transition-transform hover:-translate-y-px"
          >
            去Agent剪片
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">我的影片</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">已經完成嘅片，可以隨時下載或者分享。</p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const url = fileUrl(job.job_id, job.final_path);
            return (
              <div
                key={job.job_id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]"
              >
                {url && <video controls src={url} className="aspect-[9/16] w-full bg-black object-cover" />}
                <div className="p-4">
                  <p className="line-clamp-2 text-[13px] leading-snug text-foreground">{job.edit_request}</p>
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
