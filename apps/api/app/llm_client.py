# OpenMontage Web API — Shared LLM chat-completion dispatch
#
# Ported from OpenMontage-p2/whatsapp_mvp/llm_client.py, trimmed: dropped
# call_vision_chat + VISION_LLM_* config fields — the 3 brainstorm tools
# (video_script.py/shooting_script.py/content_idea.py) are text-only,
# never call it. call_llm_chat itself, and its retry/timeout handling
# (real production lessons — see comments below), is otherwise unchanged.

from __future__ import annotations

import concurrent.futures
import logging
import time
from typing import Optional

import requests

from .config import get_config

logger = logging.getLogger(__name__)

# requests' own `timeout=` only bounds a single socket read, not the total
# call duration — if the server dribbles bytes slowly enough that no single
# read ever stalls past `timeout`, the countdown keeps getting reset and the
# call can run far longer than the configured timeout ever implies. Enforce
# an actual wall-clock cap by running the request in a worker thread and
# giving up on waiting for it once `_HARD_CALL_DEADLINE_S` elapses — this
# does NOT cancel the underlying request (Python threads can't be killed),
# it just stops the caller from blocking on it.
_HARD_CALL_DEADLINE_S = 75
_call_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm-http")

_session = requests.Session()


def _post_bounded(
    url: str, headers: dict, body: dict, timeout: int, hard_deadline_s: Optional[float] = None
) -> requests.Response:
    future = _call_executor.submit(_session.post, url, headers=headers, json=body, timeout=timeout)
    return future.result(timeout=hard_deadline_s if hard_deadline_s is not None else _HARD_CALL_DEADLINE_S)


_MAX_ATTEMPTS = 3
_RETRY_BACKOFF_BASE_SECONDS = 1.5
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def _post_with_retries(
    label: str, url: str, headers: dict, body: dict, timeout: int
) -> Optional[dict]:
    """POST with a small retry budget for transient failures only.

    Returns the parsed JSON response body, or None if every attempt failed
    (already logged) or the failure was non-retryable.
    """
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            resp = _post_bounded(url, headers, body, timeout)
        except (
            requests.ConnectionError, requests.Timeout, requests.exceptions.ChunkedEncodingError,
            concurrent.futures.TimeoutError,
        ) as e:
            if attempt == _MAX_ATTEMPTS:
                logger.error(f"{label} call failed after {attempt} attempts (network): {e}")
                return None
            logger.warning(f"{label} call network error, retrying ({attempt}/{_MAX_ATTEMPTS}): {e}")
            time.sleep(_RETRY_BACKOFF_BASE_SECONDS * attempt)
            continue

        if resp.status_code in _RETRYABLE_STATUS_CODES and attempt < _MAX_ATTEMPTS:
            logger.warning(f"{label} call got HTTP {resp.status_code}, retrying ({attempt}/{_MAX_ATTEMPTS})")
            time.sleep(_RETRY_BACKOFF_BASE_SECONDS * attempt)
            continue

        try:
            resp.raise_for_status()
        except Exception as e:
            logger.error(f"{label} call failed (HTTP {resp.status_code}, not retrying): {e}")
            return None
        return resp.json()

    return None


def call_llm_chat(system_prompt: str, user_message: str, *, temperature: float = 0.1,
                  model: Optional[str] = None, json_mode: bool = True) -> Optional[str]:
    """Send a single-turn system+user chat completion to the configured LLM provider.

    Returns the raw text content, or None if no provider is usable or the call failed.
    """
    config = get_config()
    provider = config.llm_provider.lower()

    if provider == "claude":
        api_key = config.llm_api_key
        if not api_key:
            logger.warning("No LLM_API_KEY set for claude provider")
            return None
        data = _post_with_retries(
            "Claude",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            body={
                "model": model or config.llm_model,
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_message}],
            },
            timeout=60,
        )
        if data is None:
            return None
        try:
            return data["content"][0]["text"]
        except (KeyError, IndexError, TypeError) as e:
            logger.error(f"Claude response missing expected shape: {e}")
            return None

    # deepseek / openai / custom all speak the OpenAI-compatible chat/completions shape
    if provider == "deepseek":
        endpoint = "https://api.deepseek.com/chat/completions"
        api_key = config.deepseek_api_key or config.llm_api_key
    elif provider == "openai":
        endpoint = "https://api.openai.com/v1/chat/completions"
        api_key = config.openai_api_key or config.llm_api_key
    elif provider == "custom" or config.llm_base_url:
        base = config.llm_base_url.rstrip("/")
        if not base:
            logger.warning("LLM_PROVIDER=custom but no LLM_BASE_URL set")
            return None
        endpoint = base + ("/chat/completions" if (base.endswith("/v1") or base.endswith("/openai")) else "/v1/chat/completions")
        api_key = config.llm_api_key
    else:
        logger.warning(f"Unknown LLM provider '{provider}'")
        return None

    if not api_key:
        logger.warning(f"No API key set for provider '{provider}'")
        return None

    body = {
        "model": model or config.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    data = _post_with_retries(
        provider,
        endpoint,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        body=body,
        timeout=60,
    )
    if data is None:
        return None
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"{provider} response missing expected shape: {e}")
        return None
