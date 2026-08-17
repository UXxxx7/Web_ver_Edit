// Client-side "recent jobs" list. Originally backed both My Videos and the
// Editor picker too (apps/api had no GET /jobs list-by-user endpoint), but
// both migrated off this: My Videos now reads the account-level GET
// /users/{id}/videos (see getMyVideosAction, apps/api's
// list_done_jobs_for_user) and Editor reads its own deliberately-curated
// lib/editor-queue.ts. The one real remaining consumer is
// CommunityFeed.tsx's "which of my finished videos can I share" picker —
// a genuinely different concern (any job status counts as long as it has a
// preview, not just DONE) that didn't need the same account-level fix.
// Tracks job ids locally instead: AgentChat records one here the moment a
// job is created. Good enough for one browser/one user; doesn't survive a
// different device.
const KEY = "om_recent_jobs";
const MAX = 20;

export function addRecentJob(jobId: string): void {
  if (typeof window === "undefined") return;
  const existing = getRecentJobs().filter((id) => id !== jobId);
  const next = [jobId, ...existing].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function getRecentJobs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
