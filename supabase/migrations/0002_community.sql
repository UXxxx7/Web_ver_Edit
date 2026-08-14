-- Community feed (2026-08-13) — users share a finished video job to a
-- feed every logged-in user on the platform can see, in-house rather than
-- posting to an external platform (which we still can't automate). See
-- apps/web/lib/community.ts for the dual-mode (Supabase/mock) access
-- layer this mirrors, same pattern as 0001_init.sql's profiles/generations.
--
-- Not needed for local dev with no Supabase keys set — same fallback as
-- 0001_init.sql.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalized snapshot of the author's display name (or email, if no
  -- display_name was set) at post time — avoids an N+1 profile lookup per
  -- feed row, and a later profile rename doesn't rewrite history, which is
  -- fine/expected for a feed (matches how most social feeds behave).
  author_name text not null default '',
  -- References apps/api's Job (a different service/database — no FK
  -- possible across that boundary). video_filename is the basename of
  -- final_path/preview_path at post time, combined with job_id to build
  -- the same /api/edit-files/[jobId]/[filename] proxy URL RecentWork.tsx
  -- already uses. Referenced, not copied: if that job's storage on
  -- apps/api ever gets cleaned up, the post's video 404s — a known,
  -- accepted tradeoff for v1 (see lib/community.ts's header comment).
  job_id text not null,
  video_filename text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on posts (created_at desc);

alter table posts enable row level security;

-- Community means every logged-in user sees every post — not scoped to
-- the author like profiles/generations are.
create policy "authenticated users read all posts" on posts
  for select using (auth.role() = 'authenticated');
create policy "users insert own posts" on posts
  for insert with check (auth.uid() = user_id);
create policy "users delete own posts" on posts
  for delete using (auth.uid() = user_id);

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table post_likes enable row level security;

create policy "authenticated users read all likes" on post_likes
  for select using (auth.role() = 'authenticated');
create policy "users insert own likes" on post_likes
  for insert with check (auth.uid() = user_id);
create policy "users delete own likes" on post_likes
  for delete using (auth.uid() = user_id);
