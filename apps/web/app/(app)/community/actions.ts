"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import * as community from "@/lib/community";
import type { Comment, Post } from "@/lib/community";
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
// video-theme and /content-ideas both end in a single LLM call apiece
// (see webhook.py's get_job_video_theme / content-ideas' own generator) —
// llm_client.py's own retry budget is deliberately kept tight at that
// layer (see that file's _MAX_NETWORK_ATTEMPTS/_MAX_STATUS_ATTEMPTS
// comments — it's tuned from a real incident, not something to loosen
// casually), so a plain upstream hiccup here surfaces as "LLM unavailable"
// even though the very next call usually succeeds seconds later (confirmed
// by hand: two manual calls on the same job, first failed, second didn't).
// One retry at this call site — the lowest-stakes place to absorb that,
// since this whole feature has a real human in the loop reviewing the
// output before it's ever posted — turns most of those into a silent
// success instead of a dead-end error.
// `hasPayload` checks whether a 200 response actually contains a usable
// LLM result (both endpoints can return HTTP 200 with an empty result —
// see webhook.py's {"theme": null, "reason": "LLM unavailable"} shape) —
// a false there is worth one retry, same as a network/status failure.
async function fetchWithRetry(
  url: string, init: RequestInit | undefined, hasPayload: (body: unknown) => boolean
): Promise<Response> {
  const first = await fetch(url, init);
  if (first.ok) {
    const body: unknown = await first.clone().json().catch(() => null);
    if (body && hasPayload(body)) return first;
    await new Promise((r) => setTimeout(r, 1200));
    return fetch(url, init);
  }
  return first;
}

export async function prepareCaptionFromJobAction(
  jobId: string
): Promise<ActionResult<{ caption: string; hashtags: string[] }>> {
  await requireUser();
  const apiBase = process.env.API_BASE_URL || "http://localhost:8001";

  let themeRes: Response;
  try {
    themeRes = await fetchWithRetry(
      `${apiBase}/jobs/${encodeURIComponent(jobId)}/video-theme`, { cache: "no-store" },
      (body) => Boolean((body as { theme?: string }).theme)
    );
  } catch {
    return { ok: false, error: "Couldn't reach the video service." };
  }
  if (!themeRes.ok) return { ok: false, error: `Couldn't summarize this video (HTTP ${themeRes.status}).` };
  const themeData = await themeRes.json();
  if (!themeData.theme) {
    return { ok: false, error: "The AI didn't respond — it's sometimes just a one-off hiccup, try the button again, or write a caption yourself." };
  }

  const user = await requireUser();
  const profile = await getProfile(user.id);
  let ideaRes: Response;
  try {
    ideaRes = await fetchWithRetry(
      `${apiBase}/content-ideas`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: themeData.theme, lang: themeData.lang, brand_voice_notes: profile.brand_voice_notes }),
        cache: "no-store",
      },
      (body) => Boolean((body as { idea?: { caption?: string } }).idea?.caption)
    );
  } catch {
    return { ok: false, error: "Couldn't reach the caption generator." };
  }
  if (!ideaRes.ok) return { ok: false, error: `Caption generation failed (HTTP ${ideaRes.status}).` };
  const ideaData = await ideaRes.json();
  const idea = ideaData.idea;
  if (!idea?.caption) {
    return { ok: false, error: "The AI didn't respond — it's sometimes just a one-off hiccup, try the button again, or write a caption yourself." };
  }

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

export async function updatePostCaptionAction(postId: string, caption: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const updated = await community.updatePost(postId, user.id, caption.trim());
  if (!updated) return { ok: false, error: "Couldn't update — not found, or not your post." };
  revalidatePath("/community");
  return { ok: true, data: undefined };
}

export async function deletePostAction(postId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const deleted = await community.deletePost(postId, user.id);
  if (!deleted) return { ok: false, error: "Couldn't delete — not found, or not your post." };
  revalidatePath("/community");
  return { ok: true, data: undefined };
}

export async function getCommentsAction(postId: string): Promise<ActionResult<Comment[]>> {
  await requireUser();
  const comments = await community.listComments(postId);
  return { ok: true, data: comments };
}

export async function addCommentAction(postId: string, body: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  body = body.trim();
  if (!body) return { ok: false, error: "Write something first." };
  const profile = await getProfile(user.id);
  const authorName = profile.display_name.trim() || user.email;
  await community.addComment(postId, user.id, authorName, body);
  revalidatePath("/community");
  return { ok: true, data: undefined };
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const deleted = await community.deleteComment(commentId, user.id);
  if (!deleted) return { ok: false, error: "Couldn't delete — not found, or not yours." };
  revalidatePath("/community");
  return { ok: true, data: undefined };
}
