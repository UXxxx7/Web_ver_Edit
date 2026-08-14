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
  jobId: string;
  videoFilename: string;
  caption: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
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
        .select("id,user_id,author_name,job_id,video_filename,caption,created_at,post_likes(count)")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase.from("post_likes").select("post_id").eq("user_id", viewerId),
    ]);
    const likedIds = new Set((myLikes ?? []).map((l) => l.post_id as string));
    return (posts ?? []).map((p) => ({
      id: p.id as string,
      userId: p.user_id as string,
      authorName: p.author_name as string,
      jobId: p.job_id as string,
      videoFilename: p.video_filename as string,
      caption: p.caption as string,
      createdAt: p.created_at as string,
      // Supabase's embedded count aggregate comes back as [{ count: N }]
      // on the row, not a bare number.
      likeCount: (p.post_likes as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
      likedByMe: likedIds.has(p.id as string),
    }));
  }
  const rows = await mock.listPosts(limit);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    authorName: r.author_name,
    jobId: r.job_id,
    videoFilename: r.video_filename,
    caption: r.caption,
    createdAt: r.created_at,
    likeCount: r.liked_by.length,
    likedByMe: r.liked_by.includes(viewerId),
  }));
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
