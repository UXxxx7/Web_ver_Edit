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
from typing import Optional

from fastapi import FastAPI
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
app.include_router(jobs_router)


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
