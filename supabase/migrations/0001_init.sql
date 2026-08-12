-- OpenMontage Web — initial schema (Phase 0/1).
-- Apply once a real Supabase project exists: `supabase link` then
-- `supabase db push`, or paste into the SQL editor. Not needed for local
-- dev with no Supabase keys set — apps/web falls back to a local JSON
-- mock store (lib/store.ts) until NEXT_PUBLIC_SUPABASE_URL/ANON_KEY exist.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default '',
  preferred_lang text not null default 'zh' check (preferred_lang in ('zh', 'en')),
  brand_voice_notes text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users read own profile" on profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on profiles
  for update using (auth.uid() = id);
create policy "users insert own profile" on profiles
  for insert with check (auth.uid() = id);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('video_script', 'shooting_script', 'content_idea')),
  direction text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists generations_user_id_created_at_idx
  on generations (user_id, created_at desc);

alter table generations enable row level security;

create policy "users read own generations" on generations
  for select using (auth.uid() = user_id);
create policy "users insert own generations" on generations
  for insert with check (auth.uid() = user_id);

-- Auto-create an empty profile row the moment a new auth user signs up,
-- so lib/data.ts's getProfile() never has to distinguish "row missing" vs
-- "row empty" (mirrors what lib/store.ts's mock createUser() already does).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
