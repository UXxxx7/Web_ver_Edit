# OpenMontage Web

The OpenMontage brand's standalone product website (working subdomain:
`studio.openmontage.video`) — replaces the WhatsApp bot as the primary
product. Full plan and phased roadmap: [`implementation_plan.md`](./implementation_plan.md).

**Phase 0/1 (this repo's current state):** account system + profile, and
the 3 content-brainstorm tools (script / shot list / post idea) ported from
`OpenMontage-p2/whatsapp_mvp` at feature parity. Video clipping, C-roll
digital human, and publishing are later phases — see the roadmap.

## Structure
```
apps/web   Next.js 16 (App Router, TS, Tailwind v4, shadcn/ui) — UI, auth, profile
apps/api   FastAPI — the 3 brainstorm tools' generation logic
supabase/  Postgres schema (profiles, generations) for when a real Supabase project exists
```

## Running locally

**No cloud credentials required to run the full signup → generate → history
flow** — leave the Supabase env vars unset and `apps/web` uses a local
JSON-file mock store (`apps/web/.data/db.json`, gitignored) for accounts and
generation history instead. Generation itself still needs an LLM key to
produce real output (see below) — without one, the tools respond
gracefully with "couldn't generate" rather than fake content.

### 1. `apps/api`
```bash
cd apps/api
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optionally fill in LLM_API_KEY / CONTENT_IDEA_GEMINI_KEY
uvicorn app.main:app --reload --port 8001
```

### 2. `apps/web`
```bash
cd apps/web
npm install
cp .env.example .env.local   # leave Supabase vars blank for mock mode
npm run dev
```
Open `http://localhost:3000` — sign up with any email/password (mock mode
stores it in `.data/db.json`), fill in your profile, then use the 3
brainstorm tools. Without an LLM key configured in `apps/api`, each tool
responds with "couldn't generate — try rephrasing" (the same graceful
no-key path the original WhatsApp tools use) rather than fabricated output —
this still proves the full request/response/history wiring works end to end.

## Switching to real Supabase

1. Create a Supabase project, then apply `supabase/migrations/0001_init.sql`
   (SQL editor, or `supabase link && supabase db push`).
2. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `apps/web/.env.local`.
3. Restart `apps/web`. No code changes — `lib/auth.ts` / `lib/data.ts`
   dispatch on whether those env vars are set, and the mock store becomes
   unused. Existing mock-mode accounts don't carry over (different backing
   store) — sign up again against the real project.
