// The Editor page's ("/editor") work list — what to show used to just be
// "every job id lib/recent-jobs.ts had ever seen on this browser"
// (created, errored, revised, everything), which duplicated "My Videos"'s
// job (both ended up listing roughly the same jobs) and cluttered Editor
// with things that were never meant to be edited. De-duped per an explicit
// product decision: My Videos (apps/api's account-level DONE list, see
// getMyVideosAction) is now the single save area; this is a separate,
// deliberately-curated queue of only the videos someone actually clicked
// "Edit" on from there. Same localStorage-list shape/conventions as
// recent-jobs.ts, deliberately a sibling rather than a replacement —
// recent-jobs.ts still backs CommunityFeed.tsx's own "which of my videos
// can I share" picker, a different concern from "what am I editing now".
const KEY = "om_editor_queue";
const MAX = 30;

export function addToEditorQueue(jobId: string): void {
  if (typeof window === "undefined") return;
  const existing = getEditorQueue().filter((id) => id !== jobId);
  const next = [jobId, ...existing].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function getEditorQueue(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function removeFromEditorQueue(jobId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(getEditorQueue().filter((id) => id !== jobId)));
}
