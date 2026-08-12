# Phase 2 — Video Editing Pipeline + Remotion Engine + C-roll

Scope confirmed with user (2026-08-12): port `whatsapp_mvp`'s own automated
editing pipeline + `remotion-composer` render engine + C-roll/voice-clone —
**not** the general OpenMontage open-source framework (`tools/` registry +
`pipeline_defs/*.yaml` + `skills/`), which requires a live coding-agent
process to drive it and is a different, much larger engineering decision.
Verified via imports: `pipeline_runner.py`/`webhook.py` depend on nothing
from that general framework except one tool
(`tools/video/remotion_caption_burn.py`).

**Database**: same SQLAlchemy schema, new independent SQLite file — not
the file the live WhatsApp service is currently writing to. One real schema
change is required (see below), so "same schema" isn't literally byte-
identical, but the tables/enums are unchanged.

## Big finding that simplifies this a lot

`webhook.py` (1401 lines) is **already a general-purpose FastAPI app**, not
a WhatsApp-only handler — only 2 of its ~26 routes
(`/webhook/whatsapp` GET+POST) are WhatsApp-Cloud-API-specific. The rest
are plain JSON/multipart HTTP already, proven against real WhatsApp jobs
(the 23-rule `CLAUDE.md` in the source repo documents real production bugs
found and fixed against this exact contract):

```
POST /jobs                      create job (upload video → plan)
GET  /jobs/{job_id}              poll status
POST /jobs/{job_id}/confirm      confirm the plan
POST /jobs/{job_id}/render       trigger render
POST /jobs/{job_id}/revise       revise
POST /jobs/{job_id}/retry        retry
GET  /editor/{job_id}/props      Remotion editor SPA backend
GET  /editor/{job_id}/authored
POST /editor/{job_id}/relayout
GET  /editor/{job_id}/status
GET  /editor/{job_id}/filmstrip
GET  /editor/{job_id}/waveform
POST /jobs/{job_id}/editor_token
GET  /files/{job_id}/{filename}  serve uploaded/rendered media
POST /croll                      C-roll digital-human generation
POST /voice-clone
POST /social-batch, GET /batches/{batch_id}   (Phase 4, not now)
POST /assign, /qa, /transcribe   supporting utility routes
POST /content-ideas, /shooting-scripts, /video-scripts   (already covered, Phase 0/1)
```

Reusing these contracts verbatim means the frontend state-machine design
(upload → plan → confirm → preview → export) is **already proven**, not
something to invent — a version of this UI existed once in an earlier
`dashboard.html` revision and was deleted; rebuilding it now has a known,
tested backend to target.

## Files to move

### Python — `apps/api/app/` (new modules, alongside the Phase 0/1 ones)
`[PORT]` = verbatim copy. `[ADAPT]` = copy + a specific, named change.

- `[ADAPT]` `webhook.py` → split: keep every route except `/webhook/whatsapp`
  (GET+POST) and any WhatsApp-message-parsing code path feeding them; mount
  the rest into `apps/api/app/main.py` alongside the existing 3 brainstorm
  routes
- `[PORT]` `pipeline_runner.py`, `content_planner.py`, `concurrency.py`,
  `video_cuts.py`, `clip_factory.py`, `forced_alignment.py`,
  `props_lint.py`, `qa_stills.py`, `remotion_bundle.py`,
  `reference_analyzer.py`, `broll_providers.py`, `gemini_broll.py`,
  `music_providers.py`, `pixabay_bg_music.py`, `qa_answer.py`,
  `agent_editor.py`, `editor_token.py`, `croll_script.py`,
  `heygen_croll.py`, `voice_clone.py`
- `[ADAPT]` `database.py` — `User.whatsapp_id` (the only WhatsApp-coupled
  field in the schema) becomes `external_user_id`, storing this site's
  Supabase/mock user id (string) instead. `Job`/`Clip` models, `JobStatus`/
  `ClipStatus` enums unchanged.
- `[ADAPT]` `job_manager.py` — `get_or_create_user(whatsapp_id)` →
  `get_or_create_user(external_user_id)`, same body otherwise
- `[NEW]` `worker.py` — mirrors the original's RQ worker entrypoint, but
  registered under a **different queue name** (`openmontage-web-video-jobs`,
  vs. the original's `openmontage-video-jobs`) so the two systems' workers
  never pick up each other's jobs even though they may share local Redis
  — recommend also using a separate Redis DB index (`redis://localhost:6379/1`
  vs. the original's `/0`) for full isolation, both cheap and low-risk
- `[PORT]` `tools/video/remotion_caption_burn.py` → `apps/api/app/tools_video/remotion_caption_burn.py`
  (the one dependency out of the general `tools/` tree; not pulling in
  `tools/base_tool.py`'s registry machinery for a single file — direct import)

### `remotion-composer/` → `apps/api/remotion-composer/` (new Node subproject)
- `[PORT]` `src/`, `editor/`, `scripts/`, `package.json`, `package-lock.json`,
  `tsconfig.json`, `SCENE_TYPES.md`, `titled_video_props.json`
- `[PORT]` `public/demo-props/` (64K), `public/talking-head/` (63M — shared
  template assets referenced at render time)
- **Not copied**: `public/jobs/` (231M — old rendered job history, not
  needed fresh), `node_modules/` (631M, `npm install` instead),
  `editor-dist/`/`build/` (rebuilt, not source)

### `apps/api/storage/jobs/<job_id>/` — new, mirrors the original's
upload/render working-directory convention (gitignored)

## New local infra this phase needs (all confirmed available)
- Redis — already running (`redis-cli ping` → `PONG`); reuse the daemon,
  isolate via queue name + DB index as above
- Node v26 / npm — already present (remotion-composer needs Node ≥ 18)
- ffmpeg — already present
- API keys already sitting in `OpenMontage-p2/.env`, ready to migrate the
  same way `LLM_API_KEY`/`CONTENT_IDEA_GEMINI_KEY` were: `ELEVENLABS_API_KEY`
  (transcription/TTS), `HEYGEN_API_KEY` (C-roll), `PEXELS_API_KEY`/
  `PIXABAY_API_KEY` (b-roll), `FAL_KEY`, others as pipeline_runner.py's
  actual code paths turn out to need them

## Frontend (`apps/web`) — new work, no source to port from (old UI was deleted)
- New route, e.g. `/edit` — upload → plan → confirm → preview → export
  state machine, calling the routes above (`POST /jobs` → poll `GET /jobs/{id}`
  → `POST /jobs/{id}/confirm` → `POST /jobs/{id}/render` → poll → `GET /files/...`)
- C-roll: photo + hint upload → `POST /croll`
- Voice clone: sample upload → `POST /voice-clone`
- Whether/how the Remotion editor SPA (`editor/`, `/editor/{job_id}/*`
  routes) gets exposed in the new site's UI is still open — flag for the
  next planning pass once the core job lifecycle is working, don't build
  both at once

## Sequencing (too large for one pass — sub-phases, each independently verifiable)
1. **2a — backend port + infra**: move the Python modules above, adapt
   `database.py`/`job_manager.py`, bring `remotion-composer` over and get
   `npm install` + a manual `npx remotion render` working, wire `worker.py`
   to Redis, mount the non-WhatsApp `webhook.py` routes into
   `apps/api/app/main.py`. Verify headless via curl (create a job, poll it,
   confirm, render, fetch the output file) — no website UI yet.
2. **2b — frontend state machine**: build the upload/plan/confirm/preview/
   export UI in `apps/web`, wired to the now-working backend from 2a.
3. **2c — C-roll + voice-clone UI**: smaller, additive once 2a/2b are solid.

## 2026-08-12: 2a built and verified live — corrections to the plan above

**Correction, stated plainly: the "only depends on remotion-composer + one
tool" claim above was wrong.** It was based on a top-level-only import scan
of `pipeline_runner.py`. A full scan (including lazy/deferred imports
inside function bodies, which top-level grep misses) found pipeline_runner.py
actually imports **19 files from the general `tools/` tree**: `base_tool.py`
plus `video/{video_trimmer,remotion_caption_burn,silence_cutter,auto_reframe,
gemini_omni_video}.py`, `audio/{audio_enhance,pixabay_music,elevenlabs_tts}.py`,
`enhancement/{color_grade,face_enhance}.py`, `analysis/{transcriber,
face_tracker,frame_sampler,scene_detect}.py`. All ported to `apps/api/tools/`
(sibling package to `apps/api/app/`, matching the source repo's layout so
zero import-path edits were needed inside pipeline_runner.py itself).

**The underlying architectural distinction still holds, just wasn't fully
counted**: every one of these 19 files is a self-contained `BaseTool`
subclass (`SomeClass().execute({...})` — a plain function call), and every
one imports only `tools.base_tool` and nothing else from `tools/`, `lib/`,
`pipeline_defs/`, or `skills/` (verified by scanning each file's own
imports). None of them need `tools/tool_registry.py`'s auto-discovery or a
live coding agent — "the general agent-driven framework" claim from the
original plan is still accurate, the file *count* for the tools/ dependency
was just undercounted.

**One more real dependency found only by actually running the render**:
`remotion-composer/src/XiaojinEditorial.tsx` imports
`../../contracts/render_props.schema.json` — the repo-root `contracts/`
directory (116K, 6 JSON schema + fixture files) wasn't in the original file
list. Copied to `apps/api/contracts/` (sibling to `remotion-composer/`,
matching the source layout).

**worker.py's one `lib/`+`tool_registry` dependency was deliberately left
unported**: `_source_review_stage`'s optional pre-flight quality check
(`from lib.source_media_review import review_source_media` +
`tools.tool_registry.registry`) is wrapped in a `try/except Exception` that
already logs-and-returns-`None` on any failure (verified in source before
deciding this). Confirmed live: it throws `ModuleNotFoundError: No module
named 'lib'`, gets caught, pipeline proceeds normally. Not fixing this on
purpose — bringing in `lib/` + the tool registry's auto-discovery for one
optional step would re-open exactly the scope this plan draws a line
around.

**Real bugs found and fixed by actually running a job, not just reading
code:**
1. `authored/scene_author.py`'s `_default_llm_call` had two hardcoded
   `from whatsapp_mvp.llm_client import ...` / `from whatsapp_mvp.config
   import ...` absolute imports — that package is `app` here, not
   `whatsapp_mvp`. Fixed to relative imports (`from ..llm_client
   import ...`).
2. `tools/analysis/transcriber.py`'s forced-alignment path had the same
   bug (`from whatsapp_mvp.forced_alignment import ...`) — fixed to an
   absolute `from app.forced_alignment import ...` (can't use a relative
   import here since `tools` is a sibling package to `app`, not a parent).
3. `config.py`'s `llm_model_long_output` default (`"deepseek-v4-flash"`)
   404s against the Gemini endpoint this project's `LLM_BASE_URL` actually
   points at (a DeepSeek model id sent to Gemini's API). Not a code bug —
   fixed via `apps/api/.env`'s `LLM_MODEL_LONG_OUTPUT=gemini-flash-latest`.
4. `/jobs`'s `create_job_endpoint` was still hardcoding
   `get_or_create_user("api_user")` — the exact shared-account bug already
   fixed (via a `wa_number` form field) on `/croll`/`/social-batch`/
   `/voice-clone`, just not applied to `/jobs` yet. Added the same
   `wa_number` parameter; `apps/web` passes its own authenticated user id.

**Verified live, full round-trip, real render** (not a mock/dry-run): a
real 12s clip → `POST /jobs` → background pipeline (local faster-whisper
transcription, since `ELEVENLABS_API_KEY` is empty in the source project
too → real Gemini LLM planning, in Traditional Chinese, correctly turning
"剪掉空白位，加繁體字幕" into `[remove_filler, remove_silences,
add_subtitles(zh-TW)]`) → `WAITING_CONFIRMATION` → `POST .../confirm` →
real `npx remotion render` (subtitle burn-in) → `PREVIEW_READY` → `GET
/files/{job_id}/preview.mp4` returned a real, valid 27.5MB 1080p video with
burned-in captions. `USE_RQ_WORKER` was left unset for this — jobs run in
a background thread inside the FastAPI process itself (the code's own
default/MVP behavior, confirmed in `webhook.py`'s `_enqueue_*` functions);
a real separate RQ worker process is a fine follow-up for later, not a 2a
blocker.

**Not yet exercised**: `apply_style` (the richest, most bug-documented
part of pipeline_runner.py per the 23-rule CLAUDE.md — this test's
LLM-planned operations were `[remove_filler, remove_silences,
add_subtitles]`, no `apply_style`), C-roll (`/croll`), voice-clone
(`/voice-clone`), the editor SPA routes, and anything requiring
`HEYGEN_API_KEY` (key is in place, endpoint untested). These are real
next-verification-pass candidates, not assumed working by extension.

## 2026-08-12: 2b built (frontend job-lifecycle UI)

New `/edit` route in `apps/web`: upload form → poll → plan review/confirm →
preview + revise → export → final video + download, matching the
`JobStatus` state machine exactly (`lib/edit-jobs.ts`). Server Actions in
`app/(app)/edit/actions.ts` call apps/api's already-proven routes
(`POST /jobs` with `wa_number` = the site's own user id, `GET /jobs/{id}`
polled every 4s while in an in-progress status, `/confirm`, `/render`,
`/retry`, `/revise`). A new Route Handler (`/api/edit-files/[jobId]/
[filename]`) proxies `GET /files/...` so the browser still never talks to
apps/api directly — same reasoning as the brainstorm tools.

**Verified**: `npm run build` clean. Real end-to-end against a live
apps/api: signed up a real user (same no-JS Server Action technique as
Phase 0/1's verification), confirmed `/edit` renders authenticated,
created+confirmed+rendered a real job directly against apps/api (same
`wa_number`/field names the UI's Server Actions use), then fetched the
real rendered preview through the Next.js proxy route with the real
session cookie (200, valid video bytes) and confirmed an unauthenticated
request is blocked (proxy.ts's session gate redirects before the route
handler's own check even runs).

**Not verified**: an actual browser click-through of the upload form
itself. Unlike login/signup (which bind a Server Action directly to
`<form action={fn}>` and progressively enhance to a plain HTML POST I
could replay with curl), the upload form's `action={(fd) => handleUpload(fd)}`
wraps the server action in a client function — invoking it goes through
React's Flight/`callServer` wire protocol, which isn't practically
replayable by hand. The underlying HTTP contract it calls is the same
one already proven working directly against apps/api above, and the build
type-checks the whole call chain, but a real click in a real browser is
the next thing to actually do, not assumed from this.

**Known, deliberate gaps** (not overlooked): `NEEDS_CLARIFICATION` has no
answer path yet (no dedicated endpoint exists on the backend for it either
— see webhook.py's own scope-boundary comment about the editor SPA for the
same pattern of "documented gap, not a miss"); job ownership isn't
enforced by apps/api (see actions.ts's own header comment); the Remotion
editor SPA (`/editor/*` routes) isn't exposed in this UI at all yet —
still an open decision per the original plan.

## Explicitly not doing in this phase
- Editor SPA exposure decision (revisit after 2a/2b)
- `social_batch.py`/`social_caption.py` (Phase 4)
- Any change to the live WhatsApp service or its database/Redis queue —
  isolation (separate DB file, separate queue name, separate DB index) is
  the whole point of this plan
