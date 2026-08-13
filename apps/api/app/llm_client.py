# OpenMontage Web API — Shared LLM chat-completion dispatch
#
# Ported from OpenMontage-p2/whatsapp_mvp/llm_client.py. Phase 0/1 trimmed
# out call_vision_chat (brainstorm tools are text-only) — restored below
# for Phase 2, since qa_stills.py's vision QA step (`from .llm_client
# import call_vision_chat`, a local import inside its own function) needs
# it. call_llm_chat itself, and its retry/timeout handling (real
# production lessons — see comments below), was never touched.

from __future__ import annotations

import concurrent.futures
import logging
import threading
import time
from typing import Optional

import requests

from .config import get_config

logger = logging.getLogger(__name__)

# Real production failure (2026-08-13, job_00bc3dbd45a7): Arm B's scene_author
# and qa_stills' vision QA both call Gemini through this module, independently,
# with no coordination — fine for one job at a time, but two jobs running
# concurrently (each doing its own scene-authoring + vision-QA passes) was
# enough parallel traffic to the same Gemini key to trip its rate limit (429
# on every call in the burst, scene_author exhausting its 3 retries and Arm B
# falling through to Arm A with nothing left to render). Retrying harder
# doesn't help when the whole burst is over quota — spacing calls to this one
# host out is the actual fix. Scoped to Gemini specifically (URL match) so
# DeepSeek/OpenRouter calls, which aren't quota-constrained, stay unthrottled.
_GEMINI_HOST = "generativelanguage.googleapis.com"
_GEMINI_MIN_INTERVAL_S = 2.5
_gemini_throttle_lock = threading.Lock()
_gemini_last_call_ts = 0.0


def _throttle_if_gemini(url: str) -> None:
    global _gemini_last_call_ts
    if _GEMINI_HOST not in url:
        return
    with _gemini_throttle_lock:
        wait = _gemini_last_call_ts + _GEMINI_MIN_INTERVAL_S - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _gemini_last_call_ts = time.monotonic()

# requests' own `timeout=` only bounds a single socket read, not the total
# call duration — if the server dribbles bytes slowly enough that no single
# read ever stalls past `timeout`, the countdown keeps getting reset and the
# call can run far longer than the configured timeout ever implies. Enforce
# an actual wall-clock cap by running the request in a worker thread and
# giving up on waiting for it once `_HARD_CALL_DEADLINE_S` elapses — this
# does NOT cancel the underlying request (Python threads can't be killed),
# it just stops the caller from blocking on it.
# History: was 75, raised to 150 on 2026-08-12 after confirming a direct
# `GET /v1/models` ping succeeded in ~2s while actual chat/completions calls
# were timing out — "slow but alive" was being treated the same as "down".
# That fix backfired for the opposite case: when a call really IS dead, 150s
# x _MAX_ATTEMPTS retries means a single failed call site can burn 7.5+
# minutes before giving up, which is most of a user's entire 10-15 min patience
# budget for one job (confirmed same night: a job sat past 20+ minutes with the
# server process at 0% CPU — genuinely blocked on a dead network call, not
# "slow"). 100s is the compromise: still ~1.7x the original, enough room for
# a real-but-slow response, without making a truly dead call this expensive.
_HARD_CALL_DEADLINE_S = 100
_call_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm-http")

_session = requests.Session()


def _post_bounded(
    url: str, headers: dict, body: dict, timeout: int, hard_deadline_s: Optional[float] = None
) -> requests.Response:
    _throttle_if_gemini(url)
    future = _call_executor.submit(_session.post, url, headers=headers, json=body, timeout=timeout)
    return future.result(timeout=hard_deadline_s if hard_deadline_s is not None else _HARD_CALL_DEADLINE_S)


# Was 3, then 2 — user call (2026-08-13): drop retries entirely for now while
# DeepSeek's reliability is this bad. A failing call fails immediately (no
# second attempt eating another 100s) rather than trading a small chance of
# recovering a transient blip for a real chance of doubling the wait on a
# call that was never coming back. Every caller already has a graceful
# "LLM unavailable" fallback (empty/deterministic plan), so a fast failure
# here just means falling back to that sooner, not a worse outcome.
_MAX_ATTEMPTS = 1
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
            timeout=130,  # was 60 — see _HARD_CALL_DEADLINE_S comment (2026-08-12)
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
        timeout=130,  # was 60 — see _HARD_CALL_DEADLINE_S comment (2026-08-12)
    )
    if data is None:
        return None
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"{provider} response missing expected shape: {e}")
        return None


def call_vision_chat(text_prompt: str, image_paths: list, timeout: int = 90):
    """视觉子能力调用（独立于主 LLM 通道）。

    主规划走 LLM_*（DeepSeek，纯文本模型）；这里走 VISION_LLM_*（如智谱
    GLM-4V）——只在需要"看图"的环节使用（QA stills 复审等）。未配置
    VISION_LLM_API_KEY 时返回 None，调用方按"没有眼睛"跳过，不影响主流程。

    图片以 base64 data URL 内联（OpenAI 兼容 content-parts 格式，智谱/
    Gemini/OpenAI 通用），不依赖公网可访问的图床。
    """
    import base64
    from pathlib import Path

    from .config import get_config

    config = get_config()
    if not config.vision_llm_api_key or not config.vision_llm_base_url:
        logger.info("视觉 LLM 未配置（VISION_LLM_*），跳过看图环节")
        return None

    content: list = []
    for p in image_paths:
        p = Path(p)
        if not p.exists():
            continue
        b64 = base64.b64encode(p.read_bytes()).decode()
        content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
    if not content:
        return None
    content.append({"type": "text", "text": text_prompt})

    endpoint = config.vision_llm_base_url.rstrip("/") + "/chat/completions"
    for attempt in range(2):
        try:
            resp = _post_bounded(
                endpoint,
                {"Authorization": f"Bearer {config.vision_llm_api_key}",
                 "Content-Type": "application/json"},
                {"model": config.vision_llm_model,
                 "messages": [{"role": "user", "content": content}],
                 "temperature": 0.2,
                 # Some providers (OpenRouter's gemini-3.5-flash route, seen
                 # 2026-08-13) default max_tokens to the model's full ceiling
                 # (65536) when omitted, which 402s on a low account balance
                 # long before the model would ever actually need that many
                 # tokens for a QA-review/description response — cap it.
                 "max_tokens": 3000},
                timeout,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except (requests.exceptions.RequestException, concurrent.futures.TimeoutError) as e:
            if attempt == 0:
                import time as _time
                logger.warning(f"视觉 LLM 连接层错误，5s 后重试: {e}")
                _time.sleep(5)
                continue
            logger.error(f"视觉 LLM 调用失败: {e}")
            return None
        except Exception as e:
            logger.error(f"视觉 LLM 调用失败: {e}")
            return None
    return None
