-- Comments on community posts (2026-08-19) — same author-name-snapshot
-- pattern as posts.author_name (see 0002_community.sql's own comment for
-- why that's deliberate), same dual-mode split (apps/web/lib/community.ts
-- has the mock-store equivalent in lib/store.ts).

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx on post_comments (post_id, created_at);

alter table post_comments enable row level security;

create policy "authenticated users read all comments" on post_comments
  for select using (auth.role() = 'authenticated');
create policy "users insert own comments" on post_comments
  for insert with check (auth.uid() = user_id);
create policy "users delete own comments" on post_comments
  for delete using (auth.uid() = user_id);
