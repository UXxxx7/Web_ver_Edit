# WhatsApp MVP - Content idea generator (direction -> searched, sample post)
#
# 跟 social_caption.py 的关系：目标受众/文风硬性要求完全复用同一份（港式保险
# KOL 帖文腔调，繁體，禁用套話清單），但输入形状完全不同——social_caption.py
# 从"这条视频真实说了什么"（转写文本）出发，绝不能编造内容；这里从"用户给的
# 一个方向/主题"出发，没有视频可以约束，所以先检索真实、最新的资讯（时事/
# 费率/政策变化这类文案最怕过时），检索不到相关结果就退回模型自己的知识面，
# 但绝不编造具体数字/日期/机构名扮真实。
#
# 检索逻辑（web_search.search_context）拆两段调用是实测出来的结果，理由见
# web_search.py 文件头——这里不重复。

from __future__ import annotations

import logging
import os
from typing import Optional

from .gen_text_utils import extract_json, to_traditional
from .llm_client import call_llm_chat
from .web_search import search_context

logger = logging.getLogger(__name__)

_MAX_HASHTAGS = 6

_SYSTEM_ZH = """你要幫一個香港保險從業員/KOL 度一條社交媒體帖文文案（IG/Facebook 風格），\
題材係用戶俾嘅一個方向/主題——手上冇一條已經拍好嘅片，呢個純粹係「出 idea」用，等用戶\
自己揀一條佢鍾意嘅去拍片，或者直接攞呢條文案去發帖。

如果下面有提供「最新資訊」，優先用返呢啲真實資料嚟寫（時事、政策變化、費率呢類最怕過時嘅\
嘢），唔好夾雜錯誤或者過時嘅資料；冇提供或者搵唔到相關資訊就用返你自己知道嘅嘢寫一條通用\
啲嘅 idea，唔好編造具體數字/日期/機構名扮真實。

硬性要求（一條都唔可以違反）：
1. 寫一條真正嘅帖文，唔係一段「呢個主題可以點寫」嘅建議文字或者大綱。第一人稱／直接對讀者\
講都得，揀返最自然嗰種語氣。
2. 只用繁體字，唔可以出現簡體字。
3. 用香港口語書面語（「嘅」「啦」「喇」「咁」「唔」「佢」等），專業術語用香港講法（供款、\
保單、受保人），唔好用內地講法。
4. 篇幅精簡——真實帖文通常淨係 hashtag 之前 1-3 行短句，唔係一大段。
5. 唔好用破折號（—），一次都唔好。
6. 適量用表情符號，自然唔死板，唔好每行都塞一個。
7. 絕對唔可以出現：「在這個瞬息萬變的時代」、連續堆疊反問句、清單式開頭（例如「3個你要知嘅\
原因」）、推銷式收尾（「立即聯繫我了解更多」）、空洞行業套話。
8. hashtag 要同主題實際相關，3-6 個之間，集中放喺文案最尾。

只輸出 JSON，不要 markdown，不要任何說明文字：
{"caption": "文案正文（換行用 \\n）", "hashtags": ["#標籤1", "#標籤2"]}"""

_SYSTEM_EN = """Write a sample social media post caption (Instagram/Facebook style) for a Hong Kong \
insurance-agent KOL, on a direction/topic the user gives you — there is no filmed video yet, this is \
purely a content-idea generator so the user can pick one they like to film, or copy the caption \
directly as-is.

If "current information" is provided below, prioritize real, current facts (news, policy changes, \
rate changes — the kind of thing that goes stale fast); don't mix in wrong or outdated facts. If none \
is provided or nothing relevant turned up, fall back to a more general idea from your own knowledge — \
never invent specific numbers, dates, or institution names to sound authoritative.

Hard requirements (none negotiable):
1. Write a real caption, not advice about "how you could write about this" or an outline. First \
person or direct address, whichever reads most natural.
2. Keep it TIGHT — real posts are 1-3 short lines before the hashtags, not a paragraph.
3. No em dashes (—), ever.
4. Emojis used naturally and with a light hand, not one on every line.
5. Never write: "In today's fast-paced world...", stacked rhetorical questions, listicle framing \
("3 things you need to know"), sales CTA closers ("Contact me today to learn more"), generic \
insurance platitudes.
6. Hashtags relevant to the actual topic, 3-6, clustered at the end.

Output ONLY valid JSON, no markdown, no explanation:
{"caption": "the caption text (use \\n for line breaks)", "hashtags": ["#tag1", "#tag2"]}"""


def _clean_hashtags(raw) -> list:
    out = []
    for h in raw or []:
        h = str(h).strip().lstrip("#").strip()
        if h:
            out.append(f"#{h}")
    return out


def generate_content_idea(direction: str, lang: str = "zh") -> Optional[dict]:
    """方向/主题 -> 一条可直接复制发帖的样品文案。失败（没配 LLM/调用失败/
    解析失败）一律返回 None，绝不编一份假结果——跟这个代码库其余生成式功能
    同一个约定（social_caption.py/content_planner.py 皆是如此）。"""
    direction = (direction or "").strip()
    if not direction:
        return None

    is_zh = lang != "en"
    # CONTENT_IDEA_SEARCH_ENABLED=false 时跳过检索——响应快很多（少一次
    # ~10-30s 的网络调用），代价是文案退化成纯模型知识面（时效性内容可能不
    # 准，界面上仍会诚实标"没有检索来源"，不会假装查过资料）。
    search_enabled = os.getenv("CONTENT_IDEA_SEARCH_ENABLED", "true").lower() != "false"
    ctx = search_context(direction, lang) if search_enabled else None

    if ctx:
        context_block = (
            f"最新資訊（如果同主題相關就用返，唔啱就唔使理）：\n{ctx['summary']}\n\n方向/主題：{direction}"
            if is_zh else
            f"Current information (use if relevant to the topic, ignore if not):\n{ctx['summary']}\n\n"
            f"Direction/topic: {direction}"
        )
    else:
        context_block = f"方向/主題：{direction}" if is_zh else f"Direction/topic: {direction}"

    system_prompt = _SYSTEM_ZH if is_zh else _SYSTEM_EN
    raw = call_llm_chat(system_prompt, context_block, temperature=0.8)
    if raw is None:
        logger.info("content_idea: 没配 LLM 或调用失败，跳过")
        return None

    parsed = extract_json(raw)
    if parsed is None:
        logger.warning(f"content_idea: JSON 解析失敗，原始響應: {raw[:300]!r}")
        return None

    caption = to_traditional(str(parsed.get("caption", "")).strip()) if is_zh else str(parsed.get("caption", "")).strip()
    if not caption:
        return None
    hashtags = _clean_hashtags(parsed.get("hashtags"))[:_MAX_HASHTAGS]
    sources = ctx["sources"] if ctx else []

    return {
        "caption": caption,
        "hashtags": hashtags,
        "sources": sources,
        "grounded": bool(sources),
    }
