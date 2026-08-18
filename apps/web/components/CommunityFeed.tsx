"use client";

// In-house feed for sharing finished videos — the user's own answer to
// "we want to auto-post to other platforms but can't (no official API
// access for that)": post here instead, where posting IS something we
// control end to end. Doesn't replace posting elsewhere — a shared video
// still downloads/plays the same way it would anywhere, nothing here
// stops someone from also putting it on their own accounts.
//
// Layout deliberately copies the parts of Instagram/Facebook that make a
// feed easy for someone who's never really "posted" before: one card per
// post (avatar + name + time on top, big media, then a single obvious
// Like button), and a compose flow that starts as a single collapsed
// prompt — not an always-open form with several visible fields at once —
// so there's exactly one thing to tap to get started.
//
// `posts` is NOT held in local state — it's `initialPosts` straight from
// the Server Component (app/(app)/community/page.tsx), refetched via
// router.refresh() after create/like/delete rather than mutated
// optimistically client-side. Simpler and can't drift from the server's
// truth; the tradeoff is a network round trip before a like visibly
// updates, accepted for a first pass.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyVideosAction } from "@/app/(app)/agent/actions";
import { createPostAction, deletePostAction, toggleLikeAction } from "@/app/(app)/community/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basename, type SavedVideo } from "@/lib/edit-jobs";
import type { Post } from "@/lib/community";
import type { Lang } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

// Hand-drawn line icons — no emoji anywhere in this app.
const ICONS = {
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17l9-10",
  trash: "M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6",
  person: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5",
};

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={path} />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 20.5c-.3 0-.6-.1-.8-.3C6.8 16.6 4 14 4 10.5 4 7.9 6 6 8.4 6c1.4 0 2.7.7 3.6 1.9C12.9 6.7 14.2 6 15.6 6 18 6 20 7.9 20 10.5c0 3.5-2.8 6.1-7.2 9.7-.2.2-.5.3-.8.3Z" />
    </svg>
  );
}

// A handful of distinct, readable colors — which one a name gets is
// stable (hashed from the string) so the same person's avatar doesn't
// change color between renders/posts.
const AVATAR_COLORS = ["#3E63FF", "#22C55E", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase();
  if (!initial) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        style={{ width: size, height: size }}
      >
        <Icon path={ICONS.person} size={size * 0.5} />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}

// Shared card treatment matching the rest of the dashboard (FeatureHub,
// TemplateGallery, MyVideos) — the shadcn Card default (rounded-xl +
// ring-1) is a different, plainer look than the tinted-shadow cards used
// everywhere else in the app.
const CARD_CLASS = "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]";

const T = {
  zh: {
    title: "社群",
    subtitle: "睇下大家做咗啲乜，分享你自己嘅片——一樣可以照樣貼去其他平台，唔會少咗嗰步。",
    composePrompt: "同大家分享你嘅片…",
    pickJob: "揀一條片：",
    pickJobHint: "撳上面一條片揀返佢",
    loadingJobs: "搵緊你啲片…",
    noJobs: "仲未有做完嘅片——去Agent剪一條先。",
    captionPh: "講兩句你呢條片（可以唔寫）",
    post: "分享",
    posting: "分享緊…",
    cancel: "取消",
    empty: "仲未有人分享——做第一個嘅人啦。",
    like: "讚好",
    liked: "已讚好",
    delete: "刪除",
    confirmDelete: "刪除呢個貼文？",
    by: "分享者",
  },
  en: {
    title: "Community",
    subtitle: "See what everyone's making, or share your own — post to other platforms too, this doesn't replace that.",
    composePrompt: "Share your video with everyone…",
    pickJob: "Pick a video:",
    pickJobHint: "Tap a video above to pick it",
    loadingJobs: "Checking what you've made…",
    noJobs: "No finished videos yet — go make one in Agent first.",
    captionPh: "Say something about this one (optional)",
    post: "Share",
    posting: "Sharing…",
    cancel: "Cancel",
    empty: "Nobody's shared anything yet — be the first.",
    like: "Like",
    liked: "Liked",
    delete: "Delete",
    confirmDelete: "Delete this post?",
    by: "Shared by",
  },
} satisfies Record<Lang, Record<string, string>>;

export function CommunityFeed({
  initialPosts, currentUserId, currentUserName, lang,
}: {
  initialPosts: Post[];
  currentUserId: string;
  currentUserName: string;
  lang: Lang;
}) {
  const t = T[lang];
  const router = useRouter();
  const posts = initialPosts;

  const [composeOpen, setComposeOpen] = useState(false);
  // Same account-level list MyVideos.tsx shows (GET /users/{id}/videos) —
  // used to pull in every job this browser had ever touched (lib/recent-
  // jobs.ts, localStorage) regardless of whether it was ever saved to My
  // Videos. Sharing to Community should only ever offer what's actually in
  // My Videos, same set the user already recognizes from that page.
  const [myVideos, setMyVideos] = useState<SavedVideo[] | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  // Read off each <video>'s own loadedmetadata event (id -> seconds) — the
  // job data apps/api returns has no duration field, so this is the only
  // source for it. Keyed by job id since it arrives async, one at a time.
  const [durations, setDurations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!composeOpen || myVideos !== null) return;
    getMyVideosAction().then((result) => {
      setMyVideos(result.ok ? result.data : []);
    });
  }, [composeOpen, myVideos]);

  function closeCompose() {
    setComposeOpen(false);
    setSelectedJobId(null);
    setCaption("");
    setError(null);
  }

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
    closeCompose();
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Compose: a single tappable prompt by default (like Facebook's
          "What's on your mind") rather than a form with several fields
          visible up front — one obvious thing to do, not a checklist. */}
      <div className={CARD_CLASS}>
        {!composeOpen ? (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
          >
            <Avatar name={currentUserName} />
            <span className="flex-1 text-[15px] text-muted-foreground">{t.composePrompt}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon path={ICONS.plus} size={17} />
            </span>
          </button>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[14px] font-semibold text-foreground">{t.pickJob}</p>

            {myVideos === null && <p className="text-[13.5px] text-muted-foreground">{t.loadingJobs}</p>}
            {myVideos?.length === 0 && <p className="text-[13.5px] text-muted-foreground">{t.noJobs}</p>}
            {myVideos && myVideos.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {myVideos.map((video) => {
                    const id = video.job_id;
                    const src = fileUrl(id, video.final_path);
                    const isSelected = selectedJobId === id;
                    // Same label MyVideos.tsx itself shows under each card
                    // — without it, several similar-looking talking-head
                    // clips are indistinguishable at thumbnail size.
                    const label = video.edit_request || id;
                    const duration = durations[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedJobId(id)}
                        aria-pressed={isSelected}
                        className="flex flex-col gap-1 text-left"
                      >
                        <span
                          className={`relative block aspect-[9/16] overflow-hidden rounded-lg border-2 bg-black transition-colors ${
                            isSelected ? "border-primary" : "border-border"
                          }`}
                        >
                          {src && (
                            <video
                              src={src}
                              muted
                              preload="metadata"
                              className="h-full w-full object-cover"
                              // Frame 0 tends to look the same across clips
                              // (same room, same starting pose) — seeking a
                              // touch in gives a more representative, more
                              // distinct-looking thumbnail per video.
                              onLoadedMetadata={(e) => {
                                const v = e.currentTarget;
                                setDurations((d) => ({ ...d, [id]: v.duration }));
                                v.currentTime = Math.min(1, v.duration / 2);
                              }}
                            />
                          )}
                          {isSelected && (
                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Icon path={ICONS.check} size={14} />
                            </span>
                          )}
                          {duration ? (
                            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                              {formatDuration(duration)}
                            </span>
                          ) : null}
                        </span>
                        <span className="line-clamp-2 text-[10.5px] leading-tight text-muted-foreground">{label}</span>
                        <span className="text-[10px] text-muted-foreground/70">{relativeTime(video.created_at, lang)}</span>
                      </button>
                    );
                  })}
                </div>
                {!selectedJobId && <p className="text-[12.5px] text-muted-foreground">{t.pickJobHint}</p>}
              </>
            )}

            {selectedJobId && (
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t.captionPh}
                className="min-h-[70px] text-[15px]"
              />
            )}

            {error && <p className="text-[13.5px] text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeCompose} disabled={posting}>
                {t.cancel}
              </Button>
              <Button onClick={submitPost} disabled={posting || !selectedJobId}>
                {posting ? t.posting : t.post}
              </Button>
            </div>
          </div>
        )}
      </div>

      {posts.length === 0 && <p className="text-center text-[14px] text-muted-foreground">{t.empty}</p>}

      <div className="flex flex-col gap-5">
        {posts.map((post) => {
          const src = fileUrl(post.jobId, post.videoFilename);
          return (
            <div key={post.id} className={CARD_CLASS}>
              <div className="flex items-center gap-3 p-4 pb-3">
                <Avatar name={post.authorName || t.by} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">{post.authorName || t.by}</p>
                  <p className="text-[12.5px] text-muted-foreground">{relativeTime(post.createdAt, lang)}</p>
                </div>
                {post.userId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => remove(post.id)}
                    aria-label={t.delete}
                    className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-destructive"
                  >
                    <Icon path={ICONS.trash} size={16} />
                  </button>
                )}
              </div>

              {src && <video controls className="w-full bg-black" src={src} />}

              <div className="flex flex-col gap-3 p-4 pt-3">
                {post.caption && <p className="text-[15px] leading-relaxed text-foreground">{post.caption}</p>}
                <button
                  type="button"
                  onClick={() => like(post.id)}
                  disabled={pendingLikeId === post.id}
                  className={`flex w-fit items-center gap-2 rounded-full border-2 px-4 py-2 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
                    post.likedByMe
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:border-primary/50"
                  }`}
                >
                  <HeartIcon filled={post.likedByMe} />
                  {post.likedByMe ? t.liked : t.like}
                  {post.likeCount > 0 ? ` (${post.likeCount})` : ""}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
