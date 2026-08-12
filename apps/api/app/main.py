# OpenMontage Web API — FastAPI service.
#
# Phase 0/1: the 3 brainstorm tools (stateless, no DB — apps/web owns
# Supabase/mock-store and forwards brand_voice_notes per request).
# Phase 2: webhook.py's video-editing job routes (/jobs/*, /editor/*,
# /croll, /voice-clone, /files/*, ...) mounted as a router — see that
# file's own header for what was stripped (WhatsApp-only routes) and
# webhook.py/pipeline_runner.py's own comments for why the rest needed
# no redesign (already a plain HTTP API, proven against real jobs).
#
# Called server-to-server only (Next.js Server Actions -> here), never
# directly from a browser — no CORS middleware needed.

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .content_idea import generate_content_idea
from .shooting_script import generate_shooting_script
from .video_script import generate_video_script
from .webhook import _recover_orphaned_jobs, router as jobs_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    _recover_orphaned_jobs()
    yield


app = FastAPI(title="OpenMontage Web API", lifespan=_lifespan)

# ---------------------------------------------------------------------------
# Brainstorm tools (Phase 0/1) — registered BEFORE jobs_router is included
# below. Real bug found live (2026-08-12, user noticed the search-grounding
# feature looked unconfigured when the key was actually set): webhook.py
# (ported verbatim from OpenMontage-p2/whatsapp_mvp) has its OWN
# /content-ideas, /shooting-scripts, /video-scripts routes — a stateless,
# Form()-based variant with no brand_voice_notes support, built for the old
# Node gateway's multipart calls. FastAPI/Starlette matches routes in
# registration order, first match wins; with jobs_router included first,
# every call from apps/web (which POSTs JSON) was silently hitting
# webhook.py's Form-only handler instead and failing Pydantic validation
# (422, "direction: Field required") — not a missing-key problem at all,
# a routing shadow bug. These three routes MUST be registered before
# app.include_router(jobs_router) for that reason; don't reorder without
# re-reading this comment. webhook.py's own copies are left completely
# alone (unreachable dead code now, but "ported unchanged" means not
# touching that file to fix a problem that belongs on this side).


class BrainstormRequest(BaseModel):
    direction: str
    lang: str = "zh"
    brand_voice_notes: Optional[str] = None


def _augment_direction(direction: str, lang: str, brand_voice_notes: Optional[str]) -> str:
    """Folds the caller's profile brand-voice notes into the direction text
    rather than touching the ported generators' own prompts — keeps
    video_script.py/shooting_script.py/content_idea.py byte-identical to
    the proven WhatsApp version (see their own header comments for the
    lessons baked into those prompts)."""
    note = (brand_voice_notes or "").strip()
    if not note:
        return direction
    if lang == "en":
        return f"{direction}\n\n[Account brand-voice notes to match: {note}]"
    return f"{direction}\n\n[用戶帳號嘅品牌語氣設定，寫作時盡量貼合：{note}]"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/video-scripts")
def video_scripts(req: BrainstormRequest):
    direction = _augment_direction(req.direction, req.lang, req.brand_voice_notes)
    return {"script": generate_video_script(direction, req.lang)}


@app.post("/shooting-scripts")
def shooting_scripts(req: BrainstormRequest):
    direction = _augment_direction(req.direction, req.lang, req.brand_voice_notes)
    return {"script": generate_shooting_script(direction, req.lang)}


@app.post("/content-ideas")
def content_ideas(req: BrainstormRequest):
    direction = _augment_direction(req.direction, req.lang, req.brand_voice_notes)
    return {"idea": generate_content_idea(direction, req.lang)}


# ---------------------------------------------------------------------------
# Video-editing job routes (Phase 2) — same router at two prefixes on
# purpose: unprefixed for apps/web's Server Actions (POST /jobs, /croll,
# /voice-clone, ...), and again under /api/ because the manual editor SPA
# (ported byte-for-byte from OpenMontage-p2/remotion-composer/editor/ — see
# the block below) has its own fetch calls hardcoded to
# `/api/editor/{jobId}/...` (its vite.config.ts comment explains why: in
# the original deployment, server/index.js fronted both the Python API
# under /api/* and this static build under /editor/*, on one origin).
# Reproducing that origin-and-prefix shape here, rather than patching the
# SPA's fetch calls, is what "ported unchanged" means.
app.include_router(jobs_router)
app.include_router(jobs_router, prefix="/api")

# ---------------------------------------------------------------------------
# Manual editor SPA (ported unchanged from remotion-composer/editor/,
# built via `npm run build:editor` -> editor-dist/). vite.config.ts hardcodes
# `base: "/editor/"`, so its own asset URLs are /editor/assets/*; the shell
# page it expects to be served at is /editor/<job_id> (job id read from the
# URL path client-side, see App.tsx's useJobIdAndToken). Both are added
# without touching webhook.py's existing /editor/{job_id}/props etc. routes
# above — those take 3 path segments, this shell route takes exactly 2, so
# FastAPI's path-parameter matching never confuses the two.
_EDITOR_DIST = Path(__file__).resolve().parent.parent / "remotion-composer" / "editor-dist"
if _EDITOR_DIST.is_dir():
    app.mount("/editor/assets", StaticFiles(directory=str(_EDITOR_DIST / "assets")), name="editor-assets")

    @app.get("/editor/{job_id}")
    def editor_shell(job_id: str):
        return FileResponse(str(_EDITOR_DIST / "index.html"))
else:
    logger.warning(f"editor-dist not found at {_EDITOR_DIST} — run `npm run build:editor` in remotion-composer/")
