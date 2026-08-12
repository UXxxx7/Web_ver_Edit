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
import type { EditJob } from "@/lib/edit-jobs";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8001";

// `ok` is a literal-typed discriminant so TypeScript's control-flow
// narrowing reliably picks the right branch after `if (result.ok)`.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Both /jobs and /croll accept the same broll[]/broll_labels[]/broll_kinds[]
// shape (webhook.py deliberately keeps their registration logic line-for-
// line aligned — see create_croll_endpoint's own docstring on why). Shared
// here so AgentChat's staged-attachments list (video/photo + extra photos
// as broll + an extra video as the style reference) forwards identically
// regardless of which endpoint it's headed to.
function appendBroll(upstream: FormData, formData: FormData) {
  for (const f of formData.getAll("broll")) if (f instanceof File) upstream.append("broll", f, f.name);
  for (const l of formData.getAll("broll_labels")) upstream.append("broll_labels", String(l));
  for (const k of formData.getAll("broll_kinds")) upstream.append("broll_kinds", String(k));
}

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
  appendBroll(upstream, formData);

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
  appendBroll(upstream, formData);
  const reference = formData.get("reference");
  if (reference instanceof File && reference.size > 0) {
    upstream.set("reference", reference, reference.name);
    upstream.set("reference_kind", String(formData.get("reference_kind") ?? "video"));
  }

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
