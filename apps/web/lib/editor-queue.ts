// Client-side "staged for editor" list — job ids sent from My Videos'
// multi-select into the Editor page. Same localStorage pattern as
// recent-jobs.ts, kept as a separate key/list since being "recent" and
// being "staged for editing" are different things (a video can be recent
// without being queued up to edit, and vice versa after being removed
// from recents' MAX cap).
const KEY = "om_editor_queue";

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

export function addToEditorQueue(jobIds: string[]): void {
  if (typeof window === "undefined") return;
  const existing = getEditorQueue();
  const next = [...existing, ...jobIds.filter((id) => !existing.includes(id))];
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeFromEditorQueue(jobId: string): void {
  if (typeof window === "undefined") return;
  const next = getEditorQueue().filter((id) => id !== jobId);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
