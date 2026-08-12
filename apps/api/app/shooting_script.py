# WhatsApp MVP - Shooting script generator (方向/主题 -> 拍摄分镜)
#
# 跟 content_idea.py（发帖配文）、video_script.py（镜头前口播文案）是三个平级
# 的 brainstorm 工具，同一套"方向 -> 检索 -> 生成"骨架（检索逻辑复用
# web_search.py，理由/两段式调用的原因见该文件头）。这一个产出的是**怎么拍**
# ——分镜表：每个镜头拍什么、什么景别/角度、大概多长，用来指导实际取景，不
# 是台词本身（台词是 video_script.py 的事）。
#
# 目标格式：竖屏短视频（9:16，IG Reel/TikTok 风格）——跟这个产品其余部分
# 一致的默认交付形态（talking-head 管线、social_batch.py 的 Reel/Story 变体
# 都是这个比例），不是横屏长视频的分镜习惯。

from __future__ import annotations

import logging
import os
from typing import Optional

from .gen_text_utils import extract_json, to_traditional
from .llm_client import call_llm_chat
from .web_search import search_context

logger = logging.getLogger(__name__)

_MAX_SHOTS = 8

_SYSTEM_ZH = """你要幫一個香港保險從業員/KOL 度一條拍攝分鏡（shooting script），題材係用戶俾嘅\
一個方向/主題。目標格式：直度短片（9:16，IG Reel/TikTok 嗰種），一鏡到底或者幾個鏡頭都得，\
總長大約 20-45 秒。

呢個係「點樣拍」嘅分鏡表，唔係台詞本身——每個鏡頭寫景別/角度 + 呢個鏡頭要影乜嘢/講緊乜嘢\
重點（唔使逐字台詞），等用戶睇完知道要點樣攞機、企邊度、拍咩畫面。

如果下面有提供「最新資訊」，分鏡入面提到嘅重點可以用返呢啲真實資料，唔好夾雜錯誤或者過時\
嘅資料；冇提供就用返你自己知道嘅嘢寫一個通用啲嘅方案，唔好編造具體數字/日期扮真實。

硬性要求：
1. 3-6 個鏡頭，每個鏡頭都要講清楚：景別/角度（例如「近鏡，人面對鏡頭」「中景，手持保單」）、\
呢個鏡頭嘅內容重點（一句就夠，唔使逐字稿）、大約長度（例如「3-5秒」）。
2. 鏡頭之間要有邏輯——開場抓注意力、中段講重點、結尾有一句收尾/CTA 方向嘅鏡頭。
3. 只用繁體字，唔可以出現簡體字。
4. 貼地、可執行——一個人用手機都拍到嘅程度（唔好寫「租用穩定器/多機位」呢啲一般人做唔到嘅嘢，\
除非用戶方向本身就係講緊呢種製作規模）。
5. 唔好用破折號（—）。

只輸出 JSON，不要 markdown，不要任何說明文字：
{"summary": "整體拍攝思路，一兩句", "shots": [{"label": "鏡頭 1", "shot_type": "景別/角度", \
"content": "呢個鏡頭影乜嘢/講緊乜嘢重點", "duration_hint": "3-5秒"}], "total_duration_estimate": "約30秒"}"""

_SYSTEM_EN = """Write a shooting script (shot list) for a Hong Kong insurance-agent KOL, on a \
direction/topic the user gives you. Target format: vertical short video (9:16, IG Reel/TikTok \
style), single continuous shot or a few cuts, ~20-45 seconds total.

This is a shot list for HOW to film it, not the spoken words themselves — each shot describes \
framing/angle + the content focus of that shot (not a verbatim script), so the user knows how to \
hold the camera, where to stand, what to shoot.

If "current information" is provided below, the shot content can reference those real facts; don't \
mix in wrong or outdated information. If none is provided, use general knowledge instead — never \
invent specific numbers/dates to sound authoritative.

Hard requirements:
1. 3-6 shots, each with: framing/angle (e.g. "Close-up, facing camera" / "Medium shot, holding a \
policy document"), the content focus of that shot (one line, not a full script), and a rough \
duration (e.g. "3-5s").
2. Shots should have a logical arc — an opening hook, a middle that makes the point, a closing shot \
pointing toward a sign-off/CTA direction.
3. No em dashes (—).
4. Grounded and shootable by one person with a phone — don't suggest gear/crew a solo creator \
wouldn't have, unless the direction itself implies a bigger production.

Output ONLY valid JSON, no markdown, no explanation:
{"summary": "overall shooting approach, one or two sentences", "shots": [{"label": "Shot 1", \
"shot_type": "framing/angle", "content": "what this shot shows/focuses on", "duration_hint": "3-5s"}], \
"total_duration_estimate": "~30s"}"""


def _clean_shots(raw) -> list:
    out = []
    for s in raw or []:
        if not isinstance(s, dict):
            continue
        content = str(s.get("content", "")).strip()
        if not content:
            continue
        out.append({
            "label": str(s.get("label", "")).strip() or f"Shot {len(out) + 1}",
            "shot_type": str(s.get("shot_type", "")).strip(),
            "content": content,
            "duration_hint": str(s.get("duration_hint", "")).strip(),
        })
    return out[:_MAX_SHOTS]


def generate_shooting_script(direction: str, lang: str = "zh") -> Optional[dict]:
    """方向/主题 -> 一份拍摄分镜表。失败一律返回 None，不编假结果——跟这个
    代码库其余生成式功能同一个约定。"""
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
        logger.info("shooting_script: 没配 LLM 或调用失败，跳过")
        return None

    parsed = extract_json(raw)
    if parsed is None:
        logger.warning(f"shooting_script: JSON 解析失敗，原始響應: {raw[:300]!r}")
        return None

    shots = _clean_shots(parsed.get("shots"))
    if not shots:
        return None
    summary = str(parsed.get("summary", "")).strip()
    total = str(parsed.get("total_duration_estimate", "")).strip()
    if is_zh:
        summary = to_traditional(summary)
        total = to_traditional(total)
        for s in shots:
            s["label"] = to_traditional(s["label"])
            s["shot_type"] = to_traditional(s["shot_type"])
            s["content"] = to_traditional(s["content"])
            s["duration_hint"] = to_traditional(s["duration_hint"])

    return {
        "summary": summary,
        "shots": shots,
        "total_duration_estimate": total,
        "sources": ctx["sources"] if ctx else [],
        "grounded": bool(ctx and ctx["sources"]),
    }
