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

// Two-stage auto-caption for the "Share to Community" flow in
// AgentJobBubble.tsx: (1) apps/api reads the job's real transcript and
// summarizes it into a one-sentence theme (GET /jobs/{id}/video-theme —
// see that endpoint's own header for why this is a fresh on-demand
// endpoint rather than fixing the pre-existing dead talkinghead_social_caption/
// social_caption.py path), (2) that theme gets fed as `direction` into the
// SAME /content-ideas generator the Dashboard's 發帖文案 tool already
// calls — no new caption-writing logic, just a new source for its input.
// Returns the caption pre-filled but NOT posted — the caller shows it in
// an editable field and only calls createPostAction once the user
// confirms, same reasoning as createPostAction's own header (public
// content shouldn't get posted without a human looking at it first).
export async function prepareCaptionFromJobAction(
  jobId: string
): Promise<ActionResult<{ caption: string; hashtags: string[] }>> {
  await requireUser();
  const apiBase = process.env.API_BASE_URL || "http://localhost:8001";

  let themeRes: Response;
  try {
    themeRes = await fetch(`${apiBase}/jobs/${encodeURIComponent(jobId)}/video-theme`, { cache: "no-store" });
  } catch {
    return { ok: false, error: "Couldn't reach the video service." };
  }
  if (!themeRes.ok) return { ok: false, error: `Couldn't summarize this video (HTTP ${themeRes.status}).` };
  const themeData = await themeRes.json();
  if (!themeData.theme) {
    return { ok: false, error: "Couldn't summarize this video (no transcript, or the AI didn't respond) — write a caption yourself instead." };
  }

  const user = await requireUser();
  const profile = await getProfile(user.id);
  let ideaRes: Response;
  try {
    ideaRes = await fetch(`${apiBase}/content-ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: themeData.theme, lang: themeData.lang, brand_voice_notes: profile.brand_voice_notes }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Couldn't reach the caption generator." };
  }
  if (!ideaRes.ok) return { ok: false, error: `Caption generation failed (HTTP ${ideaRes.status}).` };
  const ideaData = await ideaRes.json();
  const idea = ideaData.idea;
  if (!idea?.caption) return { ok: false, error: "Caption generation didn't return anything usable — write one yourself instead." };

  return { ok: true, data: { caption: idea.caption as string, hashtags: (idea.hashtags as string[]) ?? [] } };
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
