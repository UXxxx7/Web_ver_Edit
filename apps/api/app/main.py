# OpenMontage Web API — FastAPI service wrapping the 3 brainstorm tools
# ported from OpenMontage-p2/whatsapp_mvp. Stateless and DB-free on purpose
# (see /implementation_plan.md): apps/web owns Supabase/mock-store and
# forwards the caller's brand_voice_notes per request, so this service
# doesn't need Supabase credentials of its own.
#
# Called server-to-server only (Next.js Server Actions -> here), never
# directly from a browser — no CORS middleware needed.

from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from .content_idea import generate_content_idea
from .shooting_script import generate_shooting_script
from .video_script import generate_video_script

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="OpenMontage Web API")


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
