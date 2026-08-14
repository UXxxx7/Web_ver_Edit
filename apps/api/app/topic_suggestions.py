# OpenMontage Web API — occupation-aware brainstorm suggestion chips.
#
# Same shape as content_idea.py (search_context for current info, then
# call_llm_chat to turn it into something usable), but the output is a
# short list of clickable direction suggestions rather than a finished
# caption — feeds the dashboard's suggestion chips so a user never has to
# type a direction from a blank box. Failure (no LLM/search key, call
# failed, bad JSON) returns None, same "never fake a result" contract as
# every other generator in this codebase.

from __future__ import annotations

import logging
from typing import Optional

from .gen_text_utils import extract_json, to_traditional
from .llm_client import call_llm_chat
from .web_search import search_context

logger = logging.getLogger(__name__)

_MAX_SUGGESTIONS = 4

_SYSTEM_ZH = """你要幫一個喺香港做「{role}」嘅人度幾條「內容方向」idea，等佢揀一條去出片/出帖，\
唔使自己諗。

如果下面有提供「最新資訊」，就由嗰啲真實、最近嘅新聞/話題/政策變化度攞靈感，唔好亂up冇根據\
嘅嘢；搵唔到相關資訊就用返呢個行業常見、實用嘅題材。

每條idea要係一句完整、具體嘅方向（唔係一個抽象嘅類別或者標題），要可以直接攞去做劇本、拍攝\
清單、或者帖文嘅起點。

硬性要求（一條都唔可以違反）：
1. 淨係用繁體字，唔可以出現簡體字。
2. 用香港口語書面語（「嘅」「啦」「咁」「唔」「佢」等）。
3. 唔好用破折號（—），一次都唔好。
4. 唔好用「喺這個瞬息萬變嘅時代」、「你要知道嘅3件事」呢類行業套話。
5. 每條idea附一個好短嘅label（4-8個字，畀撳掣用），同一句完整嘅方向句子（text，20-40字）。
6. 出返{count}條idea，唔好少過或者多過呢個數。

只輸出 JSON，不要 markdown，不要任何說明文字：
{{"suggestions": [{{"label": "短標籤", "text": "完整方向句子"}}, ...]}}"""

_SYSTEM_EN = """Brainstorm a few content-direction ideas for someone working in "{role}" (Hong Kong \
market), so they can pick one to make a video/post about instead of staring at a blank box.

If "current information" is provided below, draw ideas from those real, recent facts (news, trends, \
policy changes) — don't invent anything ungrounded. If nothing relevant turned up, fall back to \
common, practical topics for this occupation.

Each idea should be one complete, concrete direction (not an abstract category or headline) — \
something that could directly seed a script, shot list, or post caption.

Hard requirements (none negotiable):
1. No em dashes (—), ever.
2. Never write: "In today's fast-paced world...", "3 things you need to know", generic industry \
platitudes.
3. Each idea gets a short label (2-5 words, for a button) and one full direction sentence (text, \
15-30 words).
4. Return exactly {count} ideas, no more, no fewer.

Output ONLY valid JSON, no markdown, no explanation:
{{"suggestions": [{{"label": "short label", "text": "full direction sentence"}}, ...]}}"""


def generate_topic_suggestions(role: str, lang: str = "zh") -> Optional[list]:
    """occupation -> a short list of {label, text} direction suggestions,
    grounded in current search results when available. Returns None on any
    failure (no key, call failed, bad JSON) — caller falls back to its own
    static defaults, never shows a fake result."""
    role = (role or "").strip()
    if not role:
        return None

    is_zh = lang != "en"
    query = f"{role}行業最新新聞、話題、政策變化" if is_zh else f"latest news and trends for {role}"
    ctx = search_context(query, lang)

    if ctx:
        context_block = (
            f"最新資訊：\n{ctx['summary']}\n\n行業：{role}"
            if is_zh else
            f"Current information:\n{ctx['summary']}\n\nOccupation: {role}"
        )
    else:
        context_block = f"行業：{role}" if is_zh else f"Occupation: {role}"

    system_prompt = (_SYSTEM_ZH if is_zh else _SYSTEM_EN).format(role=role, count=_MAX_SUGGESTIONS)
    raw = call_llm_chat(system_prompt, context_block, temperature=0.8)
    if raw is None:
        logger.info("topic_suggestions: 没配 LLM 或调用失败，跳过")
        return None

    parsed = extract_json(raw)
    if parsed is None:
        logger.warning(f"topic_suggestions: JSON 解析失敗，原始響應: {raw[:300]!r}")
        return None

    out = []
    for item in (parsed.get("suggestions") or [])[:_MAX_SUGGESTIONS]:
        label = str((item or {}).get("label", "")).strip()
        text = str((item or {}).get("text", "")).strip()
        if not label or not text:
            continue
        if is_zh:
            label, text = to_traditional(label), to_traditional(text)
        out.append({"label": label, "text": text})

    return out or None
