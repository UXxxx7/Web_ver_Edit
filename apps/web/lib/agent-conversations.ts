// Multiple, switchable Agent conversations — same one-browser/one-device
// trust model as the single-thread version this replaces (no server-side
// chat history endpoint exists yet, see this file's predecessor's own
// header), just a list of them instead of exactly one. Each conversation
// is its own localStorage entry's worth of messages, kept generic (`T[]`,
// not `ChatMsg[]`) the same way the old file did — AgentChat.tsx owns the
// actual message shape, this file only owns persistence.
export type Conversation<T = unknown> = {
  id: string;
  title: string; // derived from the first user message; "" until one exists
  messages: T[];
  createdAt: string;
  updatedAt: string;
};

const LIST_KEY = "om_agent_conversations";
const ACTIVE_KEY = "om_agent_active_conversation";
// The old single-thread key this migrates from, once, the first time this
// runs on a browser that already has that but no conversations list yet.
const LEGACY_KEY = "om_agent_chat_history";
const MAX_MESSAGES_PER_CONVERSATION = 60;
const MAX_CONVERSATIONS = 30;
const MAX_TITLE_LEN = 40;

function readList<T>(): Conversation<T>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to the migration attempt below
  }
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    const legacyMessages = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (Array.isArray(legacyMessages) && legacyMessages.length > 0) {
      const now = new Date().toISOString();
      const migrated: Conversation<T>[] = [
        { id: `c${Date.now()}`, title: "", messages: legacyMessages, createdAt: now, updatedAt: now },
      ];
      writeList(migrated);
      window.localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
  } catch {
    // no legacy data, or it's unreadable — start empty either way
  }
  return [];
}

function writeList<T>(list: Conversation<T>[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // storage full/unavailable — same accepted tradeoff as the old file
  }
}

function titleFrom(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > MAX_TITLE_LEN ? `${trimmed.slice(0, MAX_TITLE_LEN)}…` : trimmed;
}

// Newest-updated first — a conversation you just sent a message in should
// float to the top of the switcher, same as every chat app's own list.
export function listConversations<T>(): Conversation<T>[] {
  return [...readList<T>()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversation<T>(id: string): Conversation<T> | undefined {
  return readList<T>().find((c) => c.id === id);
}

export function getActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActiveConversationId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_KEY, id);
}

export function createConversation<T>(): Conversation<T> {
  const now = new Date().toISOString();
  const conv: Conversation<T> = {
    id: `c${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    title: "", messages: [], createdAt: now, updatedAt: now,
  };
  writeList([conv, ...readList<T>()]);
  setActiveConversationId(conv.id);
  return conv;
}

// Called on every messages change (see AgentChat.tsx's persist effect) —
// upserts by id since the active conversation was already created via
// createConversation() before any messages exist.
export function saveConversationMessages<T>(id: string, messages: T[], firstUserText?: string): void {
  const list = readList<T>();
  const idx = list.findIndex((c) => c.id === id);
  const now = new Date().toISOString();
  const trimmed = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
  if (idx === -1) {
    writeList([
      { id, title: firstUserText ? titleFrom(firstUserText) : "", messages: trimmed, createdAt: now, updatedAt: now },
      ...list,
    ]);
    return;
  }
  const existing = list[idx];
  list[idx] = {
    ...existing,
    title: existing.title || (firstUserText ? titleFrom(firstUserText) : ""),
    messages: trimmed,
    updatedAt: now,
  };
  writeList(list);
}

export function deleteConversation(id: string): void {
  writeList(readList().filter((c) => c.id !== id));
}
