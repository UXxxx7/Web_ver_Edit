"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import * as community from "@/lib/community";
import type { Post } from "@/lib/community";
import { basename } from "@/lib/edit-jobs";
import { getEditJobStatus } from "@/app/(app)/agent/actions";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// Shares a finished job (must belong to the caller's own job history on
// this browser — enforced client-side via lib/recent-jobs.ts, same trust
// model as EditorPicker.tsx/RecentWork.tsx; apps/api's GET /jobs/{id}
// itself doesn't check ownership, documented gap noted in
// agent/actions.ts's own header) to the community feed. Snapshots the
// author's display name at post time — see lib/community.ts's header for
// why that's a deliberate denormalization, not an oversight.
export async function createPostAction(jobId: string, caption: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  caption = caption.trim();

  const jobResult = await getEditJobStatus(jobId);
  if (!jobResult.ok) return { ok: false, error: jobResult.error };
  const job = jobResult.data;
  const mediaPath = job.final_path || job.preview_path;
  const videoFilename = basename(mediaPath);
  if (!videoFilename) return { ok: false, error: "This job has no video yet — wait for it to finish rendering first." };

  const profile = await getProfile(user.id);
  const authorName = profile.display_name.trim() || user.email;

  await community.createPost(user.id, authorName, jobId, videoFilename, caption);
  revalidatePath("/community");
  return { ok: true, data: undefined };
}

export async function getFeedAction(): Promise<ActionResult<Post[]>> {
  const user = await requireUser();
  const posts = await community.listPosts(user.id);
  return { ok: true, data: posts };
}

export async function toggleLikeAction(postId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const user = await requireUser();
  const result = await community.toggleLike(postId, user.id);
  revalidatePath("/community");
  return { ok: true, data: result };
}

export async function deletePostAction(postId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const deleted = await community.deletePost(postId, user.id);
  if (!deleted) return { ok: false, error: "Couldn't delete — not found, or not your post." };
  revalidatePath("/community");
  return { ok: true, data: undefined };
}
