# OpenMontage Web API — Configuration
#
# Trimmed from OpenMontage-p2/whatsapp_mvp/config.py: this service only
# needs LLM_* fields (the 3 brainstorm tools' only dependency, via
# llm_client.call_llm_chat). WhatsApp/Redis/DB/storage/ElevenLabs/
# clip-factory fields from the original don't apply here — see
# /implementation_plan.md for why this stays a separate, independent repo.

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env", override=True)


@dataclass
class Config:
    # provider: deepseek | openai | claude | custom (OpenAI-compatible relay)
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "deepseek"))
    llm_api_key: str = field(
        default_factory=lambda: os.getenv(
            "LLM_API_KEY", os.getenv("DEEPSEEK_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        )
    )
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "deepseek-chat"))
    deepseek_api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))


_config: Config | None = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config()
    return _config
