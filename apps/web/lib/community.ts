// Community feed data access — same dual-mode dispatch pattern as
// lib/data.ts (real Supabase once configured, local JSON mock until
// then), kept in its own file rather than folded into lib/data.ts since
// that file's own header scopes itself to "profile + generation-history"
// and this is a third, separate concern (see supabase/migrations/
// 0002_community.sql for the schema this mirrors).
//
// Referenced, not copied: a post stores job_id + the video's filename at
// post time, and renders through the same /api/edit-files/[jobId]/
// [filename] proxy route RecentWork.tsx already uses — apps/api's Job
// storage is the source of truth for the actual file. Known tradeoff: if
// that job's storage ever gets cleaned up on apps/api's side, the post's
// video 404s. Copying the file into durable storage at post time would
// avoid that, but needs real object storage (S3/R2) which isn't wired up
// yet — referencing is what's buildable today; revisit once that exists.
import "server-only";
import * as mock from "./store";
import { createClient as createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./auth";

export type Post = {
  id: string;
  userId: string;
  authorName: string;
  // Current avatar for userId, looked up at read time (not snapshotted
  // like authorName is) — an avatar the author changes later should show
  // up on their old posts too, unlike the name which stays historical.
  authorAvatarUrl: string;
  jobId: string;
  videoFilename: string;
  caption: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export async function createPost(
  userId: string,
  authorName: string,
  jobId: string,
  videoFilename: string,
  caption: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("posts").insert({
      user_id: userId, author_name: authorName, job_id: jobId, video_filename: videoFilename, caption,
    });
    return;
  }
  await mock.createPost({ user_id: userId, author_name: authorName, job_id: jobId, video_filename: videoFilename, caption });
}

export async function listPosts(viewerId: string, limit = 50): Promise<Post[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const [{ data: posts }, { data: myLikes }] = await Promise.all([
      supabase
        .from("posts")
        .select("id,user_id,author_name,job_id,video_filename,caption,created_at,post_likes(count),post_comments(count)")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase.from("post_likes").select("post_id").eq("user_id", viewerId),
    ]);
    const likedIds = new Set((myLikes ?? []).map((l) => l.post_id as string));
    // posts.user_id and profiles.id both reference auth.users(id), but
    // aren't FK'd to each other directly, so PostgREST can't embed
    // profiles(avatar_url) on the posts query above — fetched separately
    // and merged here instead.
    const authorIds = [...new Set((posts ?? []).map((p) => p.user_id as string))];
    const { data: profiles } = authorIds.length
      ? await supabase.from("profiles").select("id,avatar_url").in("id", authorIds)
      : { data: [] as { id: string; avatar_url: string }[] };
    const avatarById = new Map((profiles ?? []).map((p) => [p.id as string, p.avatar_url as string]));
    return (posts ?? []).map((p) => ({
      id: p.id as string,
      userId: p.user_id as string,
      authorName: p.author_name as string,
      authorAvatarUrl: avatarById.get(p.user_id as string) ?? "",
      jobId: p.job_id as string,
      videoFilename: p.video_filename as string,
      caption: p.caption as string,
      createdAt: p.created_at as string,
      // Supabase's embedded count aggregate comes back as [{ count: N }]
      // on the row, not a bare number.
      likeCount: (p.post_likes as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      likedByMe: likedIds.has(p.id as string),
      commentCount: (p.post_comments as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
    }));
  }
  const rows = await mock.listPosts(limit);
  const [commentCounts, profiles] = await Promise.all([
    mock.countCommentsByPost(rows.map((r) => r.id)),
    mock.getProfilesByIds(rows.map((r) => r.user_id)),
  ]);
  const avatarById = new Map(profiles.map((p) => [p.id, p.avatar_url]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    authorName: r.author_name,
    authorAvatarUrl: avatarById.get(r.user_id) ?? "",
    jobId: r.job_id,
    videoFilename: r.video_filename,
    caption: r.caption,
    createdAt: r.created_at,
    likeCount: r.liked_by.length,
    likedByMe: r.liked_by.includes(viewerId),
    commentCount: commentCounts[r.id] ?? 0,
  }));
}

export async function updatePost(postId: string, userId: string, caption: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .from("posts").update({ caption }, { count: "exact" }).eq("id", postId).eq("user_id", userId);
    return !error && (count ?? 0) > 0;
  }
  return mock.updatePost(postId, userId, caption);
}

export async function countPostsByUser(userId: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", userId);
    return count ?? 0;
  }
  return mock.countPostsByUser(userId);
}

export async function listComments(postId: string): Promise<Comment[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("post_comments")
      .select("id,post_id,user_id,author_name,body,created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((c) => ({
      id: c.id as string, postId: c.post_id as string, userId: c.user_id as string,
      authorName: c.author_name as string, body: c.body as string, createdAt: c.created_at as string,
    }));
  }
  const rows = await mock.listComments(postId);
  return rows.map((r) => ({
    id: r.id, postId: r.post_id, userId: r.user_id, authorName: r.author_name, body: r.body, createdAt: r.created_at,
  }));
}

export async function addComment(
  postId: string, userId: string, authorName: string, body: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("post_comments").insert({ post_id: postId, user_id: userId, author_name: authorName, body });
    return;
  }
  await mock.addComment({ post_id: postId, user_id: userId, author_name: authorName, body });
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .from("post_comments").delete({ count: "exact" }).eq("id", commentId).eq("user_id", userId);
    return !error && (count ?? 0) > 0;
  }
  return mock.deleteComment(commentId, userId);
}

export async function toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase
      .from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    }
    const { count } = await supabase
      .from("post_likes").select("*", { count: "exact", head: true }).eq("post_id", postId);
    return { liked: !existing, likeCount: count ?? 0 };
  }
  const post = await mock.toggleLike(postId, userId);
  if (!post) return { liked: false, likeCount: 0 };
  return { liked: post.liked_by.includes(userId), likeCount: post.liked_by.length };
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .from("posts").delete({ count: "exact" }).eq("id", postId).eq("user_id", userId);
    return !error && (count ?? 0) > 0;
  }
  return mock.deletePost(postId, userId);
}
