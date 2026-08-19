// Mock-mode data store — a single JSON file under .data/, used ONLY when
// Supabase isn't configured (see lib/auth.ts / lib/data.ts). Lets the whole
// signup -> login -> profile -> generate -> history flow run and be
// demoed locally with zero cloud credentials, per 2026-08-12 direction
// ("先用本地假数据跑通流程,key 等我有空再配"). Swapping in real Supabase
// later requires no changes here — lib/data.ts and lib/auth.ts are the
// only call sites, and they dispatch on NEXT_PUBLIC_SUPABASE_URL.
//
// Server-only (uses node:fs) — never import this from a Client Component.

import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { GenerationKind } from "./generation-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

export type MockUser = { id: string; email: string; passwordHash: string; createdAt: string };
export type MockProfile = {
  id: string; // == user id
  display_name: string;
  role: string;
  preferred_lang: "zh" | "en";
  brand_voice_notes: string;
  avatar_url: string;
  updated_at: string;
};
export type MockGeneration = {
  id: string;
  user_id: string;
  kind: GenerationKind;
  direction: string;
  result: unknown;
  created_at: string;
};
export type MockPost = {
  id: string;
  user_id: string;
  author_name: string;
  job_id: string;
  video_filename: string;
  caption: string;
  liked_by: string[]; // user ids — mock-store equivalent of Supabase's post_likes table
  created_at: string;
};
export type MockComment = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
type DB = {
  users: MockUser[]; profiles: MockProfile[]; generations: MockGeneration[];
  posts: MockPost[]; comments: MockComment[];
};

const EMPTY_DB: DB = { users: [], profiles: [], generations: [], posts: [], comments: [] };

async function readDb(): Promise<DB> {
  try {
    const raw = await readFile(DB_PATH, "utf-8");
    return { ...EMPTY_DB, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDb(db: DB): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// Serializes all read-modify-write access so two near-simultaneous requests
// (e.g. sign-up double-click) can't race and clobber each other's write —
// each call waits for the previous one's write to land before its own read.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const db = await readDb();
    const ret = await fn(db);
    await writeDb(db);
    return ret;
  });
  // Swallow so one failed op doesn't wedge the queue for everyone after it.
  queue = result.catch(() => undefined);
  return result;
}

export async function createUser(email: string, passwordHash: string): Promise<MockUser> {
  return withLock((db) => {
    if (db.users.some((u) => u.email === email)) {
      throw new Error("email already registered");
    }
    const user: MockUser = { id: randomUUID(), email, passwordHash, createdAt: new Date().toISOString() };
    db.users.push(user);
    db.profiles.push({
      id: user.id, display_name: "", role: "", preferred_lang: "zh",
      brand_voice_notes: "", avatar_url: "", updated_at: new Date().toISOString(),
    });
    return user;
  });
}

export async function findUserByEmail(email: string): Promise<MockUser | undefined> {
  const db = await readDb();
  return db.users.find((u) => u.email === email);
}

export async function findUserById(id: string): Promise<MockUser | undefined> {
  const db = await readDb();
  return db.users.find((u) => u.id === id);
}

export async function getProfile(userId: string): Promise<MockProfile | undefined> {
  const db = await readDb();
  return db.profiles.find((p) => p.id === userId);
}

export async function upsertProfile(
  userId: string,
  fields: Partial<Omit<MockProfile, "id" | "updated_at">>
): Promise<MockProfile> {
  return withLock((db) => {
    let profile = db.profiles.find((p) => p.id === userId);
    if (!profile) {
      profile = {
        id: userId, display_name: "", role: "", preferred_lang: "zh",
        brand_voice_notes: "", avatar_url: "", updated_at: new Date().toISOString(),
      };
      db.profiles.push(profile);
    }
    Object.assign(profile, fields, { updated_at: new Date().toISOString() });
    return profile;
  });
}

export async function addGeneration(
  entry: Omit<MockGeneration, "id" | "created_at">
): Promise<MockGeneration> {
  return withLock((db) => {
    const generation: MockGeneration = {
      ...entry, id: randomUUID(), created_at: new Date().toISOString(),
    };
    db.generations.unshift(generation);
    return generation;
  });
}

export async function listGenerations(userId: string): Promise<MockGeneration[]> {
  const db = await readDb();
  return db.generations
    .filter((g) => g.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createPost(
  entry: Omit<MockPost, "id" | "liked_by" | "created_at">
): Promise<MockPost> {
  return withLock((db) => {
    const post: MockPost = { ...entry, id: randomUUID(), liked_by: [], created_at: new Date().toISOString() };
    db.posts.unshift(post);
    return post;
  });
}

export async function listPosts(limit = 50): Promise<MockPost[]> {
  const db = await readDb();
  return [...db.posts].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function toggleLike(postId: string, userId: string): Promise<MockPost | undefined> {
  return withLock((db) => {
    const post = db.posts.find((p) => p.id === postId);
    if (!post) return undefined;
    const i = post.liked_by.indexOf(userId);
    if (i === -1) post.liked_by.push(userId);
    else post.liked_by.splice(i, 1);
    return post;
  });
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  return withLock((db) => {
    const i = db.posts.findIndex((p) => p.id === postId && p.user_id === userId);
    if (i === -1) return false;
    db.posts.splice(i, 1);
    db.comments = db.comments.filter((c) => c.post_id !== postId);
    return true;
  });
}

export async function getProfilesByIds(ids: string[]): Promise<MockProfile[]> {
  const db = await readDb();
  const idSet = new Set(ids);
  return db.profiles.filter((p) => idSet.has(p.id));
}

export async function updatePost(postId: string, userId: string, caption: string): Promise<boolean> {
  return withLock((db) => {
    const post = db.posts.find((p) => p.id === postId && p.user_id === userId);
    if (!post) return false;
    post.caption = caption;
    return true;
  });
}

export async function countPostsByUser(userId: string): Promise<number> {
  const db = await readDb();
  return db.posts.filter((p) => p.user_id === userId).length;
}

// Danger-zone deletion (mock mode) — removes the user's own rows across
// every mock table, plus scrubs their id out of other users' posts'
// liked_by arrays so no dangling reference to a deleted user survives.
export async function deleteUserAccount(userId: string): Promise<void> {
  return withLock((db) => {
    db.users = db.users.filter((u) => u.id !== userId);
    db.profiles = db.profiles.filter((p) => p.id !== userId);
    db.generations = db.generations.filter((g) => g.user_id !== userId);
    db.posts = db.posts.filter((p) => p.user_id !== userId);
    db.comments = db.comments.filter((c) => c.user_id !== userId);
    for (const post of db.posts) {
      const i = post.liked_by.indexOf(userId);
      if (i !== -1) post.liked_by.splice(i, 1);
    }
  });
}

export async function countCommentsByPost(postIds: string[]): Promise<Record<string, number>> {
  const db = await readDb();
  const counts: Record<string, number> = {};
  for (const id of postIds) counts[id] = 0;
  for (const c of db.comments) if (c.post_id in counts) counts[c.post_id]++;
  return counts;
}

export async function listComments(postId: string): Promise<MockComment[]> {
  const db = await readDb();
  return db.comments
    .filter((c) => c.post_id === postId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addComment(
  entry: Omit<MockComment, "id" | "created_at">
): Promise<MockComment> {
  return withLock((db) => {
    const comment: MockComment = { ...entry, id: randomUUID(), created_at: new Date().toISOString() };
    db.comments.push(comment);
    return comment;
  });
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  return withLock((db) => {
    const i = db.comments.findIndex((c) => c.id === commentId && c.user_id === userId);
    if (i === -1) return false;
    db.comments.splice(i, 1);
    return true;
  });
}
