// Client-side "recent jobs" list — apps/api has no GET /jobs (list-by-user)
// endpoint yet (only GET /jobs/{id}), so the manual editor's standalone
// entry point (app/(app)/editor/page.tsx) can't ask the server "what are
// my jobs". Tracks job ids locally instead: AgentChat records one here the
// moment a job is created. Good enough for one browser/one user; doesn't
// survive a different device — the editor page's manual "paste a job id"
// fallback covers that case.
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
