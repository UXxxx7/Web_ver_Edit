"use server";

// Server Actions wrapping apps/api's video-editing job routes
// (webhook.py, Phase 2a) — server-to-server only, matches the same
// pattern as app/(app)/actions.ts's generateContentAction. Called
// directly as async functions from AgentChat.tsx (a Client Component),
// not via <form action> — needed for polling (getEditJobStatus) which
// isn't a form submission.
//
// Known limitation, inherited from apps/api's own design (not fixed here):
// GET /jobs/{id} doesn't check ownership — any authenticated site user who
// knows a job id could poll/confirm/render it. The UI never lists jobs
// across users (no "list my jobs" endpoint exists), so this isn't
// reachable through normal use, only by a user directly replaying another
// user's job id. Documented, not silently overlooked — see
// phase2_video_pipeline_plan.md's "known gaps" framing for the editor SPA,
// same spirit.

import { requireUser } from "@/lib/auth";
import type { EditJob, JobVersion, SavedVideo } from "@/lib/edit-jobs";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8001";

// `ok` is a literal-typed discriminant so TypeScript's control-flow
// narrowing reliably picks the right branch after `if (result.ok)`.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// /croll merges into the exact same Job lifecycle as /jobs once the
// HeyGen-generated clip exists (see webhook.py's create_croll_endpoint
// docstring) — same {job_id, status} shape, same GET /jobs/{id} polling,
// same confirm/render/revise. JobProgress.tsx is shared between this and
// createEditJob's video-upload path for exactly that reason.
export async function createCrollJob(formData: FormData): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireUser();
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "Choose a photo first." };
  const hint = String(formData.get("hint") ?? "").trim();
  const lang = String(formData.get("lang") ?? "zh");

  const upstream = new FormData();
  upstream.set("photo", photo, photo.name);
  upstream.set("hint", hint);
  upstream.set("lang", lang);
  upstream.set("pipeline", "talking-head");
  upstream.set("wa_number", user.id);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/croll`, { method: "POST", body: upstream });
  } catch {
    return { ok: false, error: "Couldn't reach the editor service — is apps/api running?" };
  }
  if (!res.ok) return { ok: false, error: `Generation failed (HTTP ${res.status}).` };
  const data = await res.json();
  return { ok: true, data: { jobId: data.job_id } };
}

// Synchronous (no job/polling) — ElevenLabs Instant Voice Clone completes
// in seconds. voice_id gets stored on this user's row and every future
// /croll call for them automatically uses it (see voice_clone.py /
// heygen_croll.py) — nothing else in the UI needs to reference voice_id.
export async function createVoiceClone(formData: FormData): Promise<ActionResult<{ voiceId: string }>> {
  const user = await requireUser();
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return { ok: false, error: "Choose an audio sample first." };

  const upstream = new FormData();
  upstream.set("audio", audio, audio.name);
  upstream.set("wa_number", user.id);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/voice-clone`, { method: "POST", body: upstream });
  } catch {
    return { ok: false, error: "Couldn't reach the editor service — is apps/api running?" };
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { ok: false, error: detail?.detail || `Voice clone failed (HTTP ${res.status}).` };
  }
  const data = await res.json();
  return { ok: true, data: { voiceId: data.voice_id } };
}

// Video-editing job. Beyond the main video/edit_request, forwards the
// Arm-B (AI-authored) inputs the apps/api /jobs route already accepts but
// the web UI never sent: `arm` (arm_a|arm_b selector), an optional style
// `reference` clip/image, and any number of manual `broll` assets each
// with an aligned label (cue) and kind. Signature stays a single FormData —
// AgentChat packs these in — so adding fields later needs no signature change.
// See armb_web_wiring_plan.md §4 and webhook.py's create_job_endpoint.
export async function createEditJob(formData: FormData): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireUser();
  const video = formData.get("video");
  if (!(video instanceof File) || video.size === 0) return { ok: false, error: "Choose a video file first." };
  const editRequest = String(formData.get("edit_request") ?? "").trim();
  if (!editRequest) return { ok: false, error: "Describe how you want it edited first." };

  const upstream = new FormData();
  upstream.set("video", video, video.name);
  upstream.set("edit_request", editRequest);
  upstream.set("pipeline", "talking-head");
  upstream.set("wa_number", user.id);

  // Arm selection: only pass arm_a / arm_b through; anything else is dropped
  // so the backend falls back to its default routing (arm_router.resolve_arm).
  const arm = String(formData.get("arm") ?? "").trim().toLowerCase();
  if (arm === "arm_a" || arm === "arm_b") upstream.set("arm", arm);

  // Optional style-reference video/image → apps/api globs it to style_ref.<ext>.
  const reference = formData.get("reference");
  if (reference instanceof File && reference.size > 0) {
    upstream.set("reference", reference, reference.name);
    const refKind = String(formData.get("reference_kind") ?? "").trim().toLowerCase();
    if (refKind === "image" || refKind === "video") upstream.set("reference_kind", refKind);
  }

  // Manual b-roll: multi-file, with per-index aligned labels (cues) and kinds.
  // All three arrays must stay same-order/same-length; `?? ""` backfills so a
  // missing label/kind never shifts the alignment (see webhook.py List[...] parsing).
  const brolls = formData.getAll("broll").filter((f): f is File => f instanceof File && f.size > 0);
  const brollLabels = formData.getAll("broll_labels").map((v) => String(v ?? ""));
  const brollKinds = formData.getAll("broll_kinds").map((v) => String(v ?? ""));
  brolls.forEach((file, i) => {
    upstream.append("broll", file, file.name);
    upstream.append("broll_labels", brollLabels[i] ?? "");
    upstream.append("broll_kinds", brollKinds[i] ?? "");
  });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/jobs`, { method: "POST", body: upstream });
  } catch {
    return { ok: false, error: "Couldn't reach the editor service — is apps/api running?" };
  }
  if (!res.ok) return { ok: false, error: `Upload failed (HTTP ${res.status}).` };
  const data = await res.json();
  return { ok: true, data: { jobId: data.job_id } };
}

export async function getEditJobStatus(jobId: string): Promise<ActionResult<EditJob>> {
  await requireUser();
  try {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Status check failed (HTTP ${res.status}).` };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, error: "Couldn't reach the editor service." };
  }
}

// Account-level "My Videos" list (GET /users/{id}/videos) — the fix for a
// real reported bug: the old MyVideos.tsx read lib/recent-jobs.ts
// (this-browser-only localStorage), so a finished video was invisible from
// any other device/browser, or after clearing site data, even though the
// job was sitting on the server the whole time. user.id doubles as the
// apps/api wa_number for this user (same mapping every other action here
// uses — see createEditJob's upstream.set("wa_number", user.id)).
export async function getMyVideosAction(): Promise<ActionResult<SavedVideo[]>> {
  const user = await requireUser();
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(user.id)}/videos`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Couldn't load your videos (HTTP ${res.status}).` };
    const data = await res.json();
    return { ok: true, data: data.videos as SavedVideo[] };
  } catch {
    return { ok: false, error: "Couldn't reach the editor service." };
  }
}

// Both scoped under /users/{id}/jobs/{jobId}/... (not just /jobs/{jobId})
// so apps/api's rename_job/delete_job can enforce ownership — see those
// functions' own comments for why this is a harder requirement for a
// mutation/deletion than the read-only endpoints elsewhere in this file.
export async function renameVideoAction(jobId: string, title: string): Promise<ActionResult<{ title: string | null }>> {
  const user = await requireUser();
  const form = new FormData();
  form.set("title", title);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/users/${encodeURIComponent(user.id)}/jobs/${encodeURIComponent(jobId)}/rename`, {
      method: "POST", body: form,
    });
  } catch {
    return { ok: false, error: "Couldn't reach the editor service." };
  }
  if (!res.ok) return { ok: false, error: `Couldn't rename (HTTP ${res.status}).` };
  const data = await res.json();
  return { ok: true, data: { title: data.title } };
}

export async function deleteVideoAction(jobId: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/users/${encodeURIComponent(user.id)}/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
  } catch {
    return { ok: false, error: "Couldn't reach the editor service." };
  }
  if (!res.ok) return { ok: false, error: `Couldn't delete (HTTP ${res.status}).` };
  return { ok: true, data: undefined };
}

export async function getJobVersionsAction(jobId: string): Promise<ActionResult<JobVersion[]>> {
  await requireUser();
  try {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/versions`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Couldn't load version history (HTTP ${res.status}).` };
    const data = await res.json();
    const versions = data.versions as {
      version_number: number; filename: string; edit_request: string | null; created_at: string | null;
    }[];
    return {
      ok: true,
      data: versions.map((v) => ({
        versionNumber: v.version_number, filename: v.filename, editRequest: v.edit_request, createdAt: v.created_at,
      })),
    };
  } catch {
    return { ok: false, error: "Couldn't reach the editor service." };
  }
}

async function postAction(path: string, body?: FormData): Promise<ActionResult<{ status: string }>> {
  await requireUser();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: "POST", body });
  } catch {
    return { ok: false, error: "Couldn't reach the editor service." };
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { ok: false, error: detail?.detail || `Request failed (HTTP ${res.status}).` };
  }
  return { ok: true, data: await res.json() };
}

export async function confirmEditJob(jobId: string): Promise<ActionResult<{ status: string }>> {
  return postAction(`/jobs/${encodeURIComponent(jobId)}/confirm`);
}

export async function renderEditJob(jobId: string): Promise<ActionResult<{ status: string }>> {
  return postAction(`/jobs/${encodeURIComponent(jobId)}/render`);
}

export async function retryEditJob(jobId: string): Promise<ActionResult<{ status: string }>> {
  return postAction(`/jobs/${encodeURIComponent(jobId)}/retry`);
}

export async function reviseEditJob(jobId: string, text: string): Promise<ActionResult<{ status: string }>> {
  const form = new FormData();
  form.set("text", text);
  return postAction(`/jobs/${encodeURIComponent(jobId)}/revise`, form);
}

// Manual editor (ported unchanged from remotion-composer/editor/, see
// main.py) — a signed, time-limited link, not a Next.js route. Opens in a
// new tab pointed straight at apps/api (config.public_base_url), same as
// the original WhatsApp flow's "open editor" link.
export async function getEditorUrl(jobId: string): Promise<ActionResult<{ editorUrl: string }>> {
  const result = await postAction(`/jobs/${encodeURIComponent(jobId)}/editor_token`);
  if (!result.ok) return result;
  const editorUrl = (result.data as unknown as { editor_url: string }).editor_url;
  return { ok: true, data: { editorUrl } };
}
