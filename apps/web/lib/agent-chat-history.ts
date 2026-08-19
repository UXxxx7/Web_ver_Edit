// Client-side persistence for AgentChat.tsx's thread — the real bug this
// fixes: AgentChat's `messages` state used to be plain in-memory useState,
// so navigating to any other page (e.g. /videos) and back unmounted the
// component and wiped the whole conversation, including the live job
// bubble for a job that was still actively processing server-side (jobs
// run in a detached daemon thread — see apps/api's _run_in_background —
// so the work itself was never actually interrupted, only the UI's memory
// of it). Confirmed via a real job: it reached WAITING_CONFIRMATION on the
// server the whole time, but the browser showed nothing on return.
//
// Same one-browser/one-device trust model as lib/recent-jobs.ts (no
// server-side chat history endpoint exists yet), and deliberately dumb:
// just the message list, restored verbatim. AgentJobBubble.tsx already
// polls GET /jobs/{id} on an interval for any job whose status is
// in-progress (see its own POLL_MS effect), so a restored job bubble
// resumes live-updating on its own the instant it remounts — no separate
// "resync on restore" logic needed here.
const KEY = "om_agent_chat_history";
// Bound storage growth — each job message carries a full EditJob snapshot
// (planned_edit.edit_operations etc.), so an unbounded thread could get
// large. 60 messages is generous for a single-session conversation and
// still cheap in localStorage.
const MAX_MESSAGES = 60;

export function saveChatHistory(messages: unknown[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full/unavailable (private browsing etc.) — losing history on
    // navigation is the pre-existing behavior, not a new failure mode.
  }
}

export function loadChatHistory<T>(): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
