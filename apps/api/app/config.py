# OpenMontage Web API — Configuration
#
# Phase 0/1 trimmed this to LLM_* fields only (brainstorm tools had nothing
# else). Phase 2 (video pipeline + C-roll) needs pipeline_runner.py's full
# original field set back — restored here from OpenMontage-p2/whatsapp_mvp/
# config.py, with two deliberate differences for isolation from the live
# WhatsApp service (see /phase2_video_pipeline_plan.md):
#   - database_url points at an independent SQLite file (openmontage_web.db,
#     not openmontage_whatsapp.db)
#   - redis_url defaults to db index 1, not 0 (queue name is also isolated,
#     see webhook.py/worker.py: "openmontage_web" not "whatsapp_mvp")
# whatsapp_* fields are kept (whatsapp_client.py/worker.py still reference
# them) but are expected to stay unset here — WhatsAppClient constructs
# fine with empty tokens, and every send is wrapped in a try/except that
# only logs on failure (see worker.py's _safe_send), so this service never
# actually talks to WhatsApp.

from __future__ import annotations

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env", override=True)


@dataclass
class Config:
    # WhatsApp Cloud API — expected unset here; see module docstring.
    whatsapp_verify_token: str = field(default_factory=lambda: os.getenv("WHATSAPP_VERIFY_TOKEN", ""))
    whatsapp_access_token: str = field(default_factory=lambda: os.getenv("WHATSAPP_ACCESS_TOKEN", ""))
    whatsapp_phone_number_id: str = field(default_factory=lambda: os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""))
    whatsapp_app_secret: str = field(default_factory=lambda: os.getenv("WHATSAPP_APP_SECRET", ""))
    editor_token_secret: str = field(
        default_factory=lambda: os.getenv("EDITOR_TOKEN_SECRET", "") or os.getenv("WHATSAPP_APP_SECRET", "")
    )

    # Redis / Queue — isolated from the WhatsApp service's db 0 + "whatsapp_mvp" queue.
    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/1"))

    # Database — independent SQLite file, not the WhatsApp service's.
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL", f"sqlite:///{_PROJECT_ROOT / 'openmontage_web.db'}"
        )
    )

    # Storage
    storage_root: Path = field(
        default_factory=lambda: Path(os.getenv("STORAGE_ROOT", str(_PROJECT_ROOT / "storage")))
    )

    public_base_url: str = field(default_factory=lambda: os.getenv("PUBLIC_BASE_URL", "http://localhost:8001"))
    local_api_base: str = field(default_factory=lambda: os.getenv("LOCAL_API_BASE", "http://127.0.0.1:8001"))

    # LLM 规划器配置 — same as Phase 0/1
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "deepseek"))
    llm_api_key: str = field(
        default_factory=lambda: os.getenv(
            "LLM_API_KEY", os.getenv("DEEPSEEK_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        )
    )
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "deepseek-chat"))
    llm_model_long_output: str = field(
        default_factory=lambda: os.getenv("LLM_MODEL_LONG_OUTPUT", "deepseek-v4-flash")
    )
    vision_llm_base_url: str = field(default_factory=lambda: os.getenv("VISION_LLM_BASE_URL", ""))
    vision_llm_api_key: str = field(default_factory=lambda: os.getenv("VISION_LLM_API_KEY", ""))
    vision_llm_model: str = field(default_factory=lambda: os.getenv("VISION_LLM_MODEL", "glm-4v-flash"))
    deepseek_api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))

    # Transcription
    transcribe_provider: str = field(default_factory=lambda: os.getenv("TRANSCRIBE_PROVIDER", "elevenlabs"))
    elevenlabs_api_key: str = field(default_factory=lambda: os.getenv("ELEVENLABS_API_KEY", ""))
    faster_whisper_model: str = field(default_factory=lambda: os.getenv("FASTER_WHISPER_MODEL", "medium"))

    # OpenMontage — root now points at apps/api itself (remotion-composer/
    # lives at apps/api/remotion-composer, not two levels up like the source repo).
    openmontage_root: Path = field(
        default_factory=lambda: Path(os.getenv("OPENMONTAGE_ROOT", str(_PROJECT_ROOT)))
    )
    remotion_preview: bool = field(default_factory=lambda: os.getenv("REMOTION_PREVIEW", "true").lower() == "true")
    social_caption_enabled: bool = field(
        default_factory=lambda: os.getenv("SOCIAL_CAPTION_ENABLED", "true").lower() == "true"
    )
    clip_factory_wall_time_s: int = field(default_factory=lambda: int(os.getenv("CLIP_FACTORY_WALL_TIME_S", "1800")))
    clip_factory_enabled: bool = field(default_factory=lambda: os.getenv("CLIP_FACTORY_ENABLED", "true").lower() == "true")

    # Providers pipeline_runner.py's b-roll/music helpers reach for.
    pexels_api_key: str = field(default_factory=lambda: os.getenv("PEXELS_API_KEY", ""))
    pixabay_api_key: str = field(default_factory=lambda: os.getenv("PIXABAY_API_KEY", ""))
    heygen_api_key: str = field(default_factory=lambda: os.getenv("HEYGEN_API_KEY", ""))

    @property
    def jobs_dir(self) -> Path:
        return self.storage_root / "jobs"

    def ensure_dirs(self) -> None:
        self.jobs_dir.mkdir(parents=True, exist_ok=True)


_config: Optional[Config] = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config()
        _config.ensure_dirs()
    return _config
