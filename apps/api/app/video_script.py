# WhatsApp MVP - Video script generator (方向/主题 -> 镜头前口播文案)
#
# 跟 content_idea.py（发帖配文）、shooting_script.py（怎么拍）是三个平级的
# brainstorm 工具，同一套"方向 -> 检索 -> 生成"骨架。这一个产出的是**讲乜嘢**
# ——镜头前实际要讲/念嘅口白內容本身，不是发布时配的文字（那是 caption 的
# 事），也不是分镜/取景指引（那是 shooting_script 的事）。
#
# 跟 croll_script.py（C-roll 数字人口播稿）的关系：目标形状很像（都是给人
# 对镜头讲的第一人称口白），但 croll_script.py 是从一张照片 + 用户 hint 出发、
# 绑定在 HeyGen 生成流程里；这里是纯 brainstorm，从一个方向/主题出发，没有
# 照片、不接生成管线，独立可用。

from __future__ import annotations

import logging
import os
from typing import Optional

from .gen_text_utils import extract_json, to_traditional
from .llm_client import call_llm_chat
from .web_search import search_context

logger = logging.getLogger(__name__)

_SYSTEM_ZH = """你要幫一個香港保險從業員/KOL 寫一段鏡頭前口播文案，題材係用戶俾嘅一個方向/\
主題。目標格式：直度短片（9:16），對住鏡頭真人講嘅嗰種，唔係讀出嚟嘅書面文章，長度大約\
20-40 秒（用真人正常語速講出嚟嘅長度嚟計，唔係文字長度）。

呢個係**要講嘅嘢本身**——真係會對住鏡頭講出口嘅字句，唔係發帖文字（帖文係另一個功能嘅事），\
都唔係分鏡/取景指引。

如果下面有提供「最新資訊」，內容可以用返呢啲真實資料，唔好夾雜錯誤或者過時嘅資料；冇提供\
就用返你自己知道嘅嘢寫一個通用啲嘅方案，唔好編造具體數字/日期扮真實。

硬性要求：
1. 寫真係會講出口嘅口語，唔係書面文章讀出嚟——短句、自然停頓（用換行分段代表停頓位），\
唔好有長句/從句堆疊呢啲書面語先有嘅結構。
2. 第一人稱，對住觀眾直接講（用「你」），開場一句要抓到注意力（唔好由「大家好」呢類開始），\
結尾一句自然收尾（唔使硬推銷式 CTA，除非方向本身就要求）。
3. 只用繁體字，唔可以出現簡體字。
4. 用香港口語（「嘅」「啦」「咁」「唔」「佢」等），專業術語用香港講法（供款、保單、受保人）。
5. 唔好用破折號（—）。
6. 唔好有「喺呢條片入面」「今日同大家講」呢類旁述式開場——直接入正題。

只輸出 JSON，不要 markdown，不要任何說明文字：
{"script": "口播文案全文（換行代表自然停頓位）", "estimated_duration_seconds": 25}"""

_SYSTEM_EN = """Write on-camera narration for a Hong Kong insurance-agent KOL, on a direction/topic \
the user gives you. Target format: vertical short video (9:16), spoken directly to camera, not read \
from a formal written piece — roughly 20-40 seconds at natural speaking pace (measured by how long \
it takes to actually SAY, not by character count).

This is the actual words to say out loud — not a social post caption (different feature) and not a \
shot list / filming guide (different feature too).

If "current information" is provided below, the content can reference those real facts; don't mix in \
wrong or outdated information. If none is provided, use general knowledge — never invent specific \
numbers/dates to sound authoritative.

Hard requirements:
1. Write words a real person would actually SAY, not a written article read aloud — short sentences, \
natural pauses (represented as line breaks), no long/nested clauses that only exist in written prose.
2. First person, speaking directly to the viewer ("you"). Open with a real hook (not "Hi everyone" or \
"Today I want to talk about"), close naturally (not a hard sales CTA unless the direction calls for it).
3. No em dashes (—).
4. No meta-narration openers ("In this video I'll...") — get straight to the point.

Output ONLY valid JSON, no markdown, no explanation:
{"script": "the full narration (line breaks = natural pause points)", "estimated_duration_seconds": 25}"""


def generate_video_script(direction: str, lang: str = "zh") -> Optional[dict]:
    """方向/主题 -> 一段镜头前口播文案。失败一律返回 None，不编假结果——跟
    这个代码库其余生成式功能同一个约定。"""
    direction = (direction or "").strip()
    if not direction:
        return None

    is_zh = lang != "en"
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
        logger.info("video_script: 没配 LLM 或调用失败，跳过")
        return None

    parsed = extract_json(raw)
    if parsed is None:
        logger.warning(f"video_script: JSON 解析失敗，原始響應: {raw[:300]!r}")
        return None

    script = str(parsed.get("script", "")).strip()
    if not script:
        return None
    if is_zh:
        script = to_traditional(script)

    try:
        duration = float(parsed.get("estimated_duration_seconds"))
    except (TypeError, ValueError):
        duration = None

    return {
        "script": script,
        "estimated_duration_seconds": duration,
        "sources": ctx["sources"] if ctx else [],
        "grounded": bool(ctx and ctx["sources"]),
    }
