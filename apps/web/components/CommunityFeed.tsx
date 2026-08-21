"use client";

// In-house feed for sharing finished videos — the user's own answer to
// "we want to auto-post to other platforms but can't (no official API
// access for that)": post here instead, where posting IS something we
// control end to end. Doesn't replace posting elsewhere — a shared video
// still downloads/plays the same way it would anywhere, nothing here
// stops someone from also putting it on their own accounts.
//
// Card layout follows Instagram's own post anatomy (header row, full-bleed
// media, icon action row, bold like count, "name + caption" line, "view
// all N comments", then an always-visible add-comment row) — the pattern
// most people already have muscle memory for, rather than inventing a
// new one. Compose flow stays the "single collapsed prompt" pattern from
// before (Facebook's "What's on your mind") — one obvious thing to tap.
//
// `posts` is NOT held in local state — it's `initialPosts` straight from
// the Server Component (app/(app)/community/page.tsx), refetched via
// router.refresh() after create/like/delete/comment rather than mutated
// optimistically client-side. Simpler and can't drift from the server's
// truth; the tradeoff is a network round trip before a like visibly
// updates, accepted for a first pass. Comments are the one exception —
// each post's comment list is fetched on demand (lazy, not part of the
// server-rendered payload) and kept in local state, since loading every
// post's full comment thread up front doesn't scale with feed length.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyVideosAction } from "@/app/(app)/agent/actions";
import {
  addCommentAction, createPostAction, deleteCommentAction, deletePostAction, getCommentsAction,
  prepareCaptionFromJobAction, toggleLikeAction, updatePostCaptionAction,
} from "@/app/(app)/community/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { basename, type SavedVideo } from "@/lib/edit-jobs";
import type { Comment, Post } from "@/lib/community";
import type { Lang } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";

function fileUrl(jobId: string, path: string | null) {
  const name = basename(path);
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

// Hand-drawn line icons — no emoji anywhere in this app.
const ICONS = {
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17l9-10",
  trash: "M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6",
  person: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5",
  sparkle: "M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.8 5.8l2.5 2.5M15.7 15.7l2.5 2.5M18.2 5.8l-2.5 2.5M8.3 15.7l-2.5 2.5",
  comment: "M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v5A1.5 1.5 0 0 1 18.5 15H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 13.5v-5Z",
  share: "M4 20l16-8L4 4v6l10 2-10 2v6Z",
  close: "M6 6l12 12M18 6 6 18",
  hash: "M9 4 7 20 M17 4l-2 16 M4 9h16 M3 15h16",
  pencil: "M4 17.5V20h2.5L18.4 8.1a1.5 1.5 0 0 0 0-2.1l-.4-.4a1.5 1.5 0 0 0-2.1 0L4 17.5Z M13.5 6.5l3 3",
  volumeOn: "M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z M15.5 9a4 4 0 0 1 0 6 M17.8 6.7a7.5 7.5 0 0 1 0 10.6",
  volumeMute: "M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z M15.5 10.5l4 4M19.5 10.5l-4 4",
  flame: "M12 3s3.5 3 3.5 6.5a3.5 3.5 0 0 1-2 3.2c1-.3 3-1.5 3-4 1.5 1.5 2.5 3.6 2.5 5.8a6.5 6.5 0 0 1-13 0c0-2.3 1-4 2.3-5.6.2 1.3 1 2.3 1.9 2.6C9 9 12 7.5 12 3Z",
  play: "M7 5.5v13l11-6.5-11-6.5Z",
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

function HeartIcon({ filled, size = 17 }: { filled: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
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

function Avatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl?: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase();
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image can't optimize/needs no optimization here
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 rounded-full object-cover ring-2 ring-card"
        style={{ width: size, height: size }}
      />
    );
  }
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
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-card"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}

// Renders a caption with #hashtags as styled, clickable pills inline with
// the rest of the text — same primary-tint-on-transparent treatment used
// for badges elsewhere in the app, just inline rather than boxed.
function CaptionText({ text, onTagClick }: { text: string; onTagClick: (tag: string) => void }) {
  const parts = text.split(HASHTAG_RE);
  const tags = text.match(HASHTAG_RE) ?? [];
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {tags[i] && (
            <button
              type="button"
              onClick={() => onTagClick(tags[i])}
              className="font-semibold text-primary hover:underline"
            >
              {tags[i]}
            </button>
          )}
        </span>
      ))}
    </>
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
    generateCaption: "AI 幫手寫",
    generatingCaption: "諗緊…",
    post: "分享",
    posting: "分享緊…",
    cancel: "取消",
    empty: "仲未有人分享——做第一個嘅人啦。",
    like: "讚好",
    liked: "已讚好",
    delete: "刪除",
    confirmDelete: "刪除呢個貼文？",
    by: "分享者",
    likesCount: (n: number) => `${n} 個讚`,
    viewComments: (n: number) => `睇晒 ${n} 個留言`,
    hideComments: "收埋留言",
    commentPh: "留言…",
    send: "送出",
    loadingComments: "載入緊留言…",
    noComments: "仲未有留言——寫低第一個。",
    deleteComment: "刪除留言",
    copyLink: "複製連結",
    linkCopied: "已複製連結！",
    clearFilter: "清除篩選",
    filteredBy: (tag: string) => `顯示緊 ${tag} 嘅貼文`,
    trending: "熱門標籤",
    topPost: "熱門",
    more: "更多",
    less: "收埋",
    edit: "編輯",
    saveCaption: "儲存",
    cancelEdit: "取消",
    mute: "靜音",
    unmute: "開聲",
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
    generateCaption: "Write with AI",
    generatingCaption: "Thinking…",
    post: "Share",
    posting: "Sharing…",
    cancel: "Cancel",
    empty: "Nobody's shared anything yet — be the first.",
    like: "Like",
    liked: "Liked",
    delete: "Delete",
    confirmDelete: "Delete this post?",
    by: "Shared by",
    likesCount: (n: number) => `${n} like${n === 1 ? "" : "s"}`,
    viewComments: (n: number) => `View all ${n} comment${n === 1 ? "" : "s"}`,
    hideComments: "Hide comments",
    commentPh: "Add a comment…",
    send: "Post",
    loadingComments: "Loading comments…",
    noComments: "No comments yet — write the first one.",
    deleteComment: "Delete comment",
    copyLink: "Copy link",
    linkCopied: "Link copied!",
    clearFilter: "Clear filter",
    filteredBy: (tag: string) => `Showing posts tagged ${tag}`,
    trending: "Trending tags",
    topPost: "Top post",
    more: "more",
    less: "less",
    edit: "Edit",
    saveCaption: "Save",
    cancelEdit: "Cancel",
    mute: "Mute",
    unmute: "Unmute",
  },
} satisfies Record<Lang, {
  title: string; subtitle: string; composePrompt: string; pickJob: string; pickJobHint: string; loadingJobs: string;
  noJobs: string; captionPh: string; generateCaption: string; generatingCaption: string; post: string; posting: string;
  cancel: string; empty: string; like: string; liked: string; delete: string; confirmDelete: string; by: string;
  likesCount: (n: number) => string; viewComments: (n: number) => string; hideComments: string; commentPh: string;
  send: string; loadingComments: string; noComments: string; deleteComment: string; copyLink: string;
  linkCopied: string; clearFilter: string; filteredBy: (tag: string) => string; trending: string; topPost: string;
  more: string; less: string; edit: string; saveCaption: string; cancelEdit: string; mute: string; unmute: string;
}>;

function CommentRow({
  comment, currentUserId, onDelete,
}: {
  comment: Comment;
  currentUserId: string;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-start gap-2.5">
      <Avatar name={comment.authorName} size={26} />
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">
        <span className="font-semibold">{comment.authorName}</span> {comment.body}
      </p>
      {comment.userId === currentUserId && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <Icon path={ICONS.trash} size={13} />
        </button>
      )}
    </div>
  );
}

export function CommunityFeed({
  initialPosts, currentUserId, currentUserName, currentUserAvatarUrl, lang,
}: {
  initialPosts: Post[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatarUrl: string;
  lang: Lang;
}) {
  const t = T[lang];
  const router = useRouter();

  const [activeTag, setActiveTag] = useState<string | null>(null);
  const posts = activeTag
    ? initialPosts.filter((p) => p.caption.toLowerCase().includes(activeTag.toLowerCase()))
    : initialPosts;

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
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  // Read off each <video>'s own loadedmetadata event (id -> seconds) — the
  // job data apps/api returns has no duration field, so this is the only
  // source for it. Keyed by job id since it arrives async, one at a time.
  const [durations, setDurations] = useState<Record<string, number>>({});
  // Which posts show a heart-burst overlay right now (double-tap on the
  // video, or the icon-row heart) — cleared automatically once the CSS
  // animation finishes (see the onAnimationEnd handler below).
  const [burstIds, setBurstIds] = useState<Set<string>>(new Set());
  // Comments: fetched lazily per post (see this file's own header for
  // why), kept separate from the server-provided `posts`.
  const [openCommentIds, setOpenCommentIds] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[] | undefined>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentPostingId, setCommentPostingId] = useState<string | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Caption "…more" clamp — long captions collapse to 2 lines until
  // expanded, per post.
  const [expandedCaptionIds, setExpandedCaptionIds] = useState<Set<string>>(new Set());
  // Inline caption editing — only one post at a time, mirrors the rename
  // pattern MyVideos.tsx already uses.
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Autoplay-in-feed: every video starts muted (browser autoplay policy
  // requires it) — this tracks which posts the viewer has explicitly
  // unmuted, not the other way round, so newly loaded posts default muted.
  const [unmutedIds, setUnmutedIds] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Disambiguates single-tap (play/pause) from double-tap (like) on the
  // video itself — a bare onDoubleClick would still fire two onClicks
  // first, so a naive single-tap handler would toggle play right before
  // the like fires. Same 250ms window every touch UI uses for this.
  const tapTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  // Top few hashtags across the whole loaded feed (not just the current
  // filter) — purely a discovery aid, computed client-side from what's
  // already loaded rather than a real backend index.
  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of initialPosts) {
      for (const tag of post.caption.match(HASHTAG_RE) ?? []) {
        const key = tag.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [initialPosts]);

  // Whichever loaded post currently has the most likes gets a small
  // badge — purely cosmetic, recomputed client-side, no backend concept
  // of "trending" involved.
  const topPostId = useMemo(() => {
    let best: Post | null = null;
    for (const post of initialPosts) {
      if (post.likeCount > 0 && (!best || post.likeCount > best.likeCount)) best = post;
    }
    return best?.id ?? null;
  }, [initialPosts]);

  useEffect(() => {
    if (!composeOpen || myVideos !== null) return;
    getMyVideosAction().then((result) => {
      setMyVideos(result.ok ? result.data : []);
    });
  }, [composeOpen, myVideos]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // Reels/TikTok-style autoplay: whichever feed video is actually in view
  // plays (muted, per browser autoplay policy), the rest stay paused —
  // rebuilt whenever the post list changes since that's when the set of
  // <video> elements changes.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    for (const video of videoRefs.current.values()) observer.observe(video);
    return () => observer.disconnect();
  }, [posts]);

  function handleVideoTap(post: Post) {
    const pending = tapTimers.current[post.id];
    if (pending) {
      clearTimeout(pending);
      tapTimers.current[post.id] = null;
      doubleTapLike(post);
      return;
    }
    tapTimers.current[post.id] = setTimeout(() => {
      tapTimers.current[post.id] = null;
      const video = videoRefs.current.get(post.id);
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }, 250);
  }

  function toggleMute(postId: string) {
    setUnmutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function startEditCaption(post: Post) {
    setEditingPostId(post.id);
    setEditDraft(post.caption);
  }

  async function saveEditCaption(postId: string) {
    setSavingEdit(true);
    await updatePostCaptionAction(postId, editDraft);
    setSavingEdit(false);
    setEditingPostId(null);
    router.refresh();
  }

  function closeCompose() {
    setComposeOpen(false);
    setSelectedJobId(null);
    setCaption("");
    setError(null);
  }

  async function generateCaption() {
    if (!selectedJobId) return;
    setError(null);
    setGeneratingCaption(true);
    const result = await prepareCaptionFromJobAction(selectedJobId);
    setGeneratingCaption(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const tags = result.data.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    setCaption(tags ? `${result.data.caption}\n\n${tags}` : result.data.caption);
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

  function triggerBurst(postId: string) {
    setBurstIds((prev) => new Set(prev).add(postId));
  }

  function clearBurst(postId: string) {
    setBurstIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  }

  async function like(postId: string) {
    setPendingLikeId(postId);
    await toggleLikeAction(postId);
    setPendingLikeId(null);
    router.refresh();
  }

  // Double-tap only ever likes, same as Instagram — it never unlikes, even
  // if you keep double-tapping. The burst plays every time regardless, so
  // it still feels responsive on an already-liked post.
  function doubleTapLike(post: Post) {
    triggerBurst(post.id);
    if (!post.likedByMe) like(post.id);
  }

  async function remove(postId: string) {
    if (!window.confirm(t.confirmDelete)) return;
    await deletePostAction(postId);
    router.refresh();
  }

  async function toggleComments(postId: string) {
    setOpenCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
    if (!commentsByPost[postId]) {
      const result = await getCommentsAction(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: result.ok ? result.data : [] }));
    }
  }

  async function submitComment(postId: string) {
    const body = (commentDrafts[postId] ?? "").trim();
    if (!body) return;
    setCommentPostingId(postId);
    await addCommentAction(postId, body);
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    const result = await getCommentsAction(postId);
    setCommentsByPost((prev) => ({ ...prev, [postId]: result.ok ? result.data : prev[postId] }));
    setOpenCommentIds((prev) => new Set(prev).add(postId));
    setCommentPostingId(null);
    router.refresh(); // syncs the comment count shown on the collapsed link
  }

  async function removeComment(postId: string, commentId: string) {
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
    }));
    await deleteCommentAction(commentId);
    router.refresh();
  }

  function copyLink(postId: string) {
    const url = `${window.location.origin}/community#post-${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPostId(postId);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedPostId(null), 1600);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in srgb, #EF4444 12%, transparent)", color: "#EF4444" }}
        >
          <HeartIcon filled size={20} />
        </span>
        <div>
          <h1 className="bg-gradient-to-r from-[#EF4444] via-[#8B5CF6] to-[#3E63FF] bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            {t.title}
          </h1>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      {trendingTags.length > 0 && !activeTag && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
            <Icon path={ICONS.hash} size={11} />
            {t.trending}
          </span>
          {trendingTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className="rounded-full bg-secondary px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/70"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {activeTag && (
        <button
          type="button"
          onClick={() => setActiveTag(null)}
          className="flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <Icon path={ICONS.hash} size={12} />
          {t.filteredBy(activeTag)}
          <Icon path={ICONS.close} size={12} />
        </button>
      )}

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
            <Avatar name={currentUserName} avatarUrl={currentUserAvatarUrl} />
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
              <div className="flex flex-col gap-1.5">
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t.captionPh}
                  className="min-h-[70px] text-[15px]"
                />
                <button
                  type="button"
                  onClick={generateCaption}
                  disabled={generatingCaption}
                  className="flex w-fit items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-default disabled:opacity-60"
                >
                  {generatingCaption ? (
                    <span className="dash-spinner" />
                  ) : (
                    <Icon path={ICONS.sparkle} size={13} />
                  )}
                  {generatingCaption ? t.generatingCaption : t.generateCaption}
                </button>
              </div>
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
          const isBursting = burstIds.has(post.id);
          const commentsOpen = openCommentIds.has(post.id);
          const comments = commentsByPost[post.id];
          return (
            <div key={post.id} id={`post-${post.id}`} className={CARD_CLASS}>
              <div className="flex items-center gap-3 p-4 pb-3">
                <Avatar name={post.authorName || t.by} avatarUrl={post.authorAvatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">{post.authorName || t.by}</p>
                  <p className="text-[12.5px] text-muted-foreground">{relativeTime(post.createdAt, lang)}</p>
                </div>
                {post.userId === currentUserId && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => startEditCaption(post)}
                      aria-label={t.edit}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                    >
                      <Icon path={ICONS.pencil} size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(post.id)}
                      aria-label={t.delete}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-destructive"
                    >
                      <Icon path={ICONS.trash} size={16} />
                    </button>
                  </div>
                )}
              </div>

              {src && (
                <div className="relative bg-black" onClick={() => handleVideoTap(post)}>
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(post.id, el);
                      else videoRefs.current.delete(post.id);
                    }}
                    src={src}
                    muted={!unmutedIds.has(post.id)}
                    loop
                    playsInline
                    className="w-full"
                  />
                  {post.id === topPostId && (
                    <span
                      className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm"
                    >
                      <Icon path={ICONS.flame} size={13} />
                      {t.topPost}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute(post.id);
                    }}
                    aria-label={unmutedIds.has(post.id) ? t.mute : t.unmute}
                    className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                  >
                    <Icon path={unmutedIds.has(post.id) ? ICONS.volumeOn : ICONS.volumeMute} size={16} />
                  </button>
                  {isBursting && (
                    <span
                      onAnimationEnd={() => clearBurst(post.id)}
                      className="heart-burst pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                      aria-hidden
                    >
                      <HeartIcon filled size={84} />
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 p-4 pt-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => like(post.id)}
                    disabled={pendingLikeId === post.id}
                    aria-label={post.likedByMe ? t.liked : t.like}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                      post.likedByMe ? "text-[#EF4444]" : "text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <HeartIcon filled={post.likedByMe} size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleComments(post.id)}
                    aria-label={t.viewComments(post.commentCount)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/60"
                  >
                    <Icon path={ICONS.comment} size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyLink(post.id)}
                    aria-label={t.copyLink}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/60"
                  >
                    <Icon path={ICONS.share} size={19} />
                  </button>
                  {copiedPostId === post.id && (
                    <span className="text-[12px] font-medium text-primary">{t.linkCopied}</span>
                  )}
                </div>

                {post.likeCount > 0 && (
                  <p className="text-[13.5px] font-semibold text-foreground">{t.likesCount(post.likeCount)}</p>
                )}

                {editingPostId === post.id ? (
                  <div className="flex flex-col gap-1.5">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="min-h-[60px] text-[14px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingPostId(null)} disabled={savingEdit}>
                        {t.cancelEdit}
                      </Button>
                      <Button size="sm" onClick={() => saveEditCaption(post.id)} disabled={savingEdit}>
                        {t.saveCaption}
                      </Button>
                    </div>
                  </div>
                ) : post.caption ? (
                  <p className={`text-[14.5px] leading-relaxed text-foreground ${expandedCaptionIds.has(post.id) ? "" : "line-clamp-2"}`}>
                    <span className="font-semibold">{post.authorName || t.by}</span>{" "}
                    <CaptionText text={post.caption} onTagClick={setActiveTag} />
                  </p>
                ) : null}

                {!editingPostId && post.caption && post.caption.length > 100 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCaptionIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(post.id)) next.delete(post.id);
                        else next.add(post.id);
                        return next;
                      })
                    }
                    className="w-fit text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {expandedCaptionIds.has(post.id) ? t.less : t.more}
                  </button>
                )}

                {post.commentCount > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleComments(post.id)}
                    className="w-fit text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {commentsOpen ? t.hideComments : t.viewComments(post.commentCount)}
                  </button>
                )}

                {commentsOpen && (
                  <div className="flex flex-col gap-2.5 border-t border-border pt-2.5">
                    {comments === undefined && <p className="text-[12.5px] text-muted-foreground">{t.loadingComments}</p>}
                    {comments?.length === 0 && <p className="text-[12.5px] text-muted-foreground">{t.noComments}</p>}
                    {comments?.map((c) => (
                      <CommentRow
                        key={c.id}
                        comment={c}
                        currentUserId={currentUserId}
                        onDelete={(id) => removeComment(post.id, id)}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-border pt-2.5">
                  <Avatar name={currentUserName} avatarUrl={currentUserAvatarUrl} size={26} />
                  <input
                    type="text"
                    value={commentDrafts[post.id] ?? ""}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitComment(post.id);
                    }}
                    placeholder={t.commentPh}
                    className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  {(commentDrafts[post.id] ?? "").trim() && (
                    <button
                      type="button"
                      onClick={() => submitComment(post.id)}
                      disabled={commentPostingId === post.id}
                      className="shrink-0 text-[13px] font-semibold text-primary disabled:opacity-60"
                    >
                      {t.send}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
