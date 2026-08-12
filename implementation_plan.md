# OpenMontage Web — Implementation Plan

Full feature-parity with the WhatsApp product is the actual end goal (per
2026-08-12 direction: website becomes the primary product). That's a large
surface — ~30 Python modules in `OpenMontage-p2/whatsapp_mvp`, including a
3493-line video-editing pipeline with 23 documented edge-case fixes — so it's
still built in phases, but every phase below is now committed scope, not
"maybe later." **This plan's execution steps cover Phase 0 + Phase 1.**
Phase 2+ get their own plan when we reach them.

## Confirmed decisions (2026-08-12)
- **Brand**: OpenMontage is not a name collision — it's the team's own
  open-source project (`dsd12356994`/`ritzmarvel` are both heavy contributors
  on `UXxxx7/OpenMontage`; the public project has real traction — GitHub
  Trending, `openmontage.video`, a YouTube channel). New site **reuses the
  OpenMontage brand on a subdomain**. Working subdomain: `studio.openmontage.video`
  (matches existing internal naming — `whatsapp-studio` branch, `server/studio.html`)
  — cheap to change later (just a DNS record), not blocking.
- **Auth + DB**: **Supabase** — Auth, Postgres, and file storage in one
  service. Replaces the earlier "simple password gate" decision.
- **Color system**: Indigo Navy + Electric Blue, replacing the current
  terracotta/cream (`#d97757` / `#f5f3ef`) — see tokens below.
- **Alan's video-editing reference style**: not ready yet. Deferred — Phase 2
  proceeds on professional judgment until reference material is available.

## Architecture
- **`apps/web`** — Next.js 14 (App Router, TS, Tailwind, shadcn/ui). Owns
  auth (Supabase session via `@supabase/ssr`), profile UI, and the brainstorm
  dashboard UI.
- **`apps/api`** — FastAPI (Python). Ports the 3 brainstorm tools' logic
  verbatim from `OpenMontage-p2/whatsapp_mvp` (proven, bug-hardened — see
  that repo's `web_search.py` header for a real fixed bug in this exact
  logic). **Stays stateless / no DB coupling** — `apps/web` fetches the
  caller's profile from Supabase (already has the session) and forwards the
  relevant fields (`brand_voice_notes`, `preferred_lang`) in the request
  body, so `apps/api` never needs Supabase credentials of its own.
- **Supabase** — Postgres (`profiles`, `generations` tables), Auth
  (email+password to start, OAuth providers addable later), Storage (for
  Phase 2+ media). Schema managed via the Supabase CLI's own migration
  files (`supabase/migrations/`) rather than bolting on a second ORM —
  one less moving part, and `supabase gen types typescript` gives type
  safety for free.

Why Python stays the backend for brainstorm logic: unchanged reasoning from
the original plan — small, self-contained, already has real production
lessons baked in. Rewriting it for no functional gain is the wrong call.

## Directory layout (target)
```
openmontage-web/
  apps/
    web/
      app/
        (auth)/login/page.tsx        Supabase email+password sign-in
        (auth)/signup/page.tsx       sign-up
        profile/page.tsx             display name, role, preferred_lang, brand_voice_notes
        page.tsx                     brainstorm dashboard (3 tools), ported from dashboard.html
      middleware.ts                  Supabase session check, redirects unauthenticated -> /login
      components/BrainstormTool.tsx  shared generator-bar + result-card UI
      lib/supabase/client.ts         browser client
      lib/supabase/server.ts         server client (route handlers, middleware)
      lib/api.ts                     fetch wrapper -> apps/api
      app/globals.css                design tokens (see below)
      tailwind.config.ts
    api/
      main.py                        FastAPI app, CORS, 3 routes
      video_script.py                [PORTED verbatim from OpenMontage-p2/whatsapp_mvp]
      shooting_script.py             [PORTED verbatim]
      content_idea.py                [PORTED verbatim]
      web_search.py                  [PORTED verbatim]
      gen_text_utils.py              [PORTED verbatim]
      llm_client.py                  [PORTED, trimmed: drop call_vision_chat + vision fields]
      config.py                      [PORTED, trimmed: LLM_* fields only]
      requirements.txt
  supabase/
    migrations/0001_init.sql         profiles + generations tables, RLS policies
    config.toml
  README.md
  .env.example
  .gitignore
```

## Database schema (Phase 0/1)
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text,                    -- e.g. "保險從業員/KOL"
  preferred_lang text default 'zh',
  brand_voice_notes text,       -- free-form style/tone notes fed into generation prompts
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,           -- 'video_script' | 'shooting_script' | 'content_idea'
  direction text not null,
  result jsonb not null,
  created_at timestamptz default now()
);
-- RLS: users can only read/write their own rows in both tables.
```
`generations` is a natural addition now that real accounts exist — gives
users a history of past brainstorm output instead of the current
stateless-chat-only UI (which loses everything on refresh).

## API contract (unchanged from the existing dashboard.html client)
- `POST /video-scripts {direction, lang, brand_voice_notes?}` → `{script: {...}}`
- `POST /shooting-scripts {direction, lang, brand_voice_notes?}` → `{script: {...}}`
- `POST /content-ideas {direction, lang, brand_voice_notes?}` → `{idea: {...}}`

## Design tokens (Indigo Navy + Electric Blue)
```
Light:  --bg:#F4F6FB --card:#FFFFFF --text:#0F1B3C --muted:#5B6B8C
        --accent:#3E63FF --accent-ink:#FFFFFF --border:#DEE3F0
        --bubble-user:#0F1B3C --bubble-user-text:#F4F6FB --nav-bg:#FFFFFF
Dark:   --bg:#0B1020 --card:#141B33 --text:#EDEFF7 --muted:#9AA4C4
        --accent:#6C8CFF --accent-ink:#0B1020 --border:#262E4D
        --bubble-user:#6C8CFF --bubble-user-text:#0B1020 --nav-bg:#10152B
```
Same variable structure as `dashboard.html` (mechanical swap), same
light/dark + chat-thread + gen-bar visual language, new palette.

## Execution steps (this session, after go-ahead)
1. Scaffold `apps/web` (`create-next-app`, TS, Tailwind, App Router, `@/*` alias)
2. Supabase project setup: `supabase/migrations/0001_init.sql`, `.env.example` entries (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Auth: login/signup pages, `middleware.ts` session gate, profile page (read/write `profiles`)
4. `apps/api`: copy + trim the 7 Python files, add `requirements.txt` + `main.py`
5. Port `dashboard.html` UI into React components with new design tokens; wire fetches to `apps/api`, save each result to `generations`
6. Root `README.md` (how to run both dev servers + Supabase local dev), `.env.example`, `.gitignore`
7. Verify: `npm run build` clean; `uvicorn` boots and all 3 endpoints respond; sign-up → login → generate → see it saved in `generations` end to end

## Roadmap
- **Phase 2 — video clipping pipeline + C-roll**: now actively planned, see
  [`phase2_video_pipeline_plan.md`](./phase2_video_pipeline_plan.md) (2026-08-12).
  Captured requirements for when the UI/template work in that phase starts: 
  - Rebrand the video templates' color palette to match the new Indigo/
    Electric-Blue system (currently the earthy "warm" `colorMode` — see
    `OpenMontage-p2/whatsapp_mvp/CLAUDE.md` Rule 4 for how `colorMode`
    palettes work in `remotion-composer`)
  - Curate a style based on Alan's reference edits — **blocked on him
    sharing the material**
  - Bigger caption/data-card font sizes in the templates
  - Design how job state (upload/plan/confirm/preview/export) surfaces in
    the website UI — read `OpenMontage-p2/whatsapp_mvp/CLAUDE.md`'s 23 rules
    before touching `pipeline_runner.py` itself, real bugs are documented there
- **Phase 3 — C-roll digital human**: `croll_script.py` + `heygen_croll.py`
- **Phase 4 — voice cloning, social batch captioning, real publish-flow**
- OAuth sign-in providers, team/multi-role accounts (Phase 0/1 ships email+password only)

## Open, non-blocking
- LLM/Gemini API keys: reuse `OpenMontage-p2`'s keys, or issue this project separate ones?
- Actually pointing `studio.openmontage.video` DNS at the deployed app — deploy-time step, not needed for local dev.
