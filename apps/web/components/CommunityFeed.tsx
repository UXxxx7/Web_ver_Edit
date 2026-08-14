"use client";

// In-house feed for sharing finished videos — the user's own answer to
// "we want to auto-post to other platforms but can't (no official API
// access for that)": post here instead, where posting IS something we
// control end to end. Doesn't replace posting elsewhere — a shared video
// still downloads/plays the same way it would anywhere, nothing here
// stops someone from also putting it on their own accounts.
//
// `posts` is NOT held in local state — it's `initialPosts` straight from
// the Server Component (app/(app)/community/page.tsx), refetched via
// router.refresh() after create/like/delete rather than mutated
// optimistically client-side. Simpler and can't drift from the server's
// truth; the tradeoff is a network round trip before a like visibly
// updates, accepted for a first pass.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEditJobStatus } from "@/app/(app)/agent/actions";
import { createPostAction, deletePostAction, toggleLikeAction } from "@/app/(app)/community/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { basename, type EditJob } from "@/lib/edit-jobs";
import type { Post } from "@/lib/community";
import type { Lang } from "@/lib/i18n";
import { getRecentJobs } from "@/lib/recent-jobs";
import { relativeTime } from "@/lib/relative-time";

const READY_STATUSES = new Set(["DONE", "PREVIEW_READY", "CLIPS_READY"]);

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

// Hand-drawn heart, same treatment as every other icon in the app — no emoji.
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5c-.3 0-.6-.1-.8-.3C6.8 16.6 4 14 4 10.5 4 7.9 6 6 8.4 6c1.4 0 2.7.7 3.6 1.9C12.9 6.7 14.2 6 15.6 6 18 6 20 7.9 20 10.5c0 3.5-2.8 6.1-7.2 9.7-.2.2-.5.3-.8.3Z" />
    </svg>
  );
}

// Shared card treatment matching the rest of the dashboard (FeatureHub,
// TemplateGallery, MyVideos) — the shadcn Card default (rounded-xl +
// ring-1) is a different, plainer look than the tinted-shadow cards used
// everywhere else in the app.
const CARD_CLASS = "rounded-2xl border border-border shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] ring-0";

const T = {
  zh: {
    title: "社群",
    subtitle: "睇下大家做咗啲乜，或者 share 返你自己嘅作品——照樣可以貼去其他平台，唔會少咗嗰步。",
    composeTitle: "分享一條片",
    pickJob: "揀一條完成咗嘅片",
    loadingJobs: "check緊你有咩片…",
    noJobs: "仲未有做完嘅片——去 Agent 剪一條先。",
    captionPh: "講兩句你呢條片（可選）",
    post: "分享",
    posting: "分享緊…",
    empty: "仲未有人分享——做第一個嘅人啦。",
    like: "讚好",
    liked: "已讚好",
    delete: "刪除",
    confirmDelete: "刪除呢個貼文？",
    by: "分享者：",
  },
  en: {
    title: "Community",
    subtitle: "See what everyone's making, or share your own — post to other platforms too, this doesn't replace that.",
    composeTitle: "Share a video",
    pickJob: "Pick a finished video",
    loadingJobs: "Checking what you've made…",
    noJobs: "No finished videos yet — go make one in Agent first.",
    captionPh: "Say something about this one (optional)",
    post: "Share",
    posting: "Sharing…",
    empty: "Nobody's shared anything yet — be the first.",
    like: "Like",
    liked: "Liked",
    delete: "Delete",
    confirmDelete: "Delete this post?",
    by: "by",
  },
} satisfies Record<Lang, Record<string, string>>;

export function CommunityFeed({
  initialPosts, currentUserId, lang,
}: {
  initialPosts: Post[];
  currentUserId: string;
  lang: Lang;
}) {
  const t = T[lang];
  const router = useRouter();
  const posts = initialPosts;

  const [readyJobs, setReadyJobs] = useState<{ id: string; job: EditJob }[] | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(
      getRecentJobs().map(async (id) => {
        const r = await getEditJobStatus(id);
        return r.ok ? { id, job: r.data } : null;
      })
    ).then((results) => {
      const ready = results.filter(
        (r): r is { id: string; job: EditJob } =>
          r !== null && READY_STATUSES.has(r.job.status) && Boolean(r.job.final_path || r.job.preview_path)
      );
      setReadyJobs(ready);
    });
  }, []);

  async function submitPost() {
    if (!selectedJobId) return;
    setPosting(true);
    setError(null);
    const result = await createPostAction(selectedJobId, caption);
    setPosting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCaption("");
    setSelectedJobId(null);
    router.refresh();
  }

  async function like(postId: string) {
    setPendingLikeId(postId);
    await toggleLikeAction(postId);
    setPendingLikeId(null);
    router.refresh();
  }

  async function remove(postId: string) {
    if (!window.confirm(t.confirmDelete)) return;
    await deletePostAction(postId);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card className={CARD_CLASS}>
        <CardContent className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t.composeTitle}</h3>

          {readyJobs === null && <p className="text-sm text-muted-foreground">{t.loadingJobs}</p>}
          {readyJobs?.length === 0 && <p className="text-sm text-muted-foreground">{t.noJobs}</p>}
          {readyJobs && readyJobs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t.pickJob}</p>
              <div className="flex flex-col gap-1.5">
                {readyJobs.map(({ id, job }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedJobId(id)}
                    className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedJobId === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="truncate">
                      {job.planned_edit?.summary?.split("\n")[0] || job.edit_request || id}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{relativeTime(job.created_at, lang)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedJobId && (
            <>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t.captionPh}
                className="min-h-[70px]"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={submitPost} disabled={posting} className="self-end">
                {posting ? t.posting : t.post}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {posts.length === 0 && <p className="text-center text-sm text-muted-foreground">{t.empty}</p>}

      <div className="flex flex-col gap-5">
        {posts.map((post) => {
          const src = fileUrl(post.jobId, post.videoFilename);
          return (
            <Card key={post.id} className={CARD_CLASS}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{post.authorName || t.by}</Badge>
                    <span className="text-xs text-muted-foreground">{relativeTime(post.createdAt, lang)}</span>
                  </div>
                  {post.userId === currentUserId && (
                    <Button variant="ghost" size="sm" onClick={() => remove(post.id)} className="text-destructive">
                      {t.delete}
                    </Button>
                  )}
                </div>

                {src && <video controls className="mx-auto w-full max-w-[320px] rounded-lg" src={src} />}

                {post.caption && <p className="text-sm">{post.caption}</p>}

                <Button
                  variant={post.likedByMe ? "default" : "outline"}
                  size="sm"
                  disabled={pendingLikeId === post.id}
                  onClick={() => like(post.id)}
                  className="w-fit"
                >
                  <HeartIcon filled={post.likedByMe} /> {post.likeCount} {post.likedByMe ? t.liked : t.like}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
