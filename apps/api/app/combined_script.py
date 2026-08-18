# WhatsApp MVP - Combined script + shot list generator (方向/主题 -> 一份
# 台詞連分鏡嘅表，機位/B-roll 同對白對齊)
#
# 取代分開兩個功能（video_script.py 出台詞、shooting_script.py 出分鏡）——
# 用戶提供咗一份專業製作公司出嘅參考資料（真實已完成嘅拍攝），格式係一個
# 兩欄表：分鏡（機位/B-roll）| 對白，逐行對齊，唔係兩份互相獨立嘅文件。
# 呢個生成器直接產出嗰種對齊格式：每個「beat」有自己嘅鏡頭資訊（望鏡頭
# 定 B-roll、景別/角度）+ 呢一刻講緊嘅對白（B-roll 段落可以係度延續緊
# 之前嘅旁白，都可以係純畫面停頓、對白留空）。
#
# video_script.py/shooting_script.py 仍然保留住（未刪），舊嘅生成歷史紀錄
# 仲要用嗰兩個嘅 result 格式先睇到；但呢個先係而家 apps/web brainstorm UI
# 用緊嗰個生成入口。
#
# 新增 movement 參數（用戶明確要求）：呢條片影嘅時候，人郁唔郁得多——
# 靜態企定/坐定，定係郁動幾多，帶到出去行，定係成日轉場、郁動好多。呢個
# 會影響建議幾多個機位/位置轉換，唔係淨係得美學上嘅分別。

from __future__ import annotations

import logging
import os
from typing import Optional

from .gen_text_utils import extract_json, to_traditional
from .llm_client import call_llm_chat
from .web_search import search_context

logger = logging.getLogger(__name__)

_MAX_BEATS = 14

_MOVEMENT_GUIDANCE_ZH = {
    "static": "呢條片人企定/坐定拍，唔郁位——全程淨係 1-2 個機位（例如「望鏡頭近鏡」「望鏡頭中景」\
之間切換），唔好建議行來行去或者轉場地。",
    "walk": "呢條片可以有啲自然郁動——例如邊行邊講，或者喺 2-3 個唔同角度/位置之間切換，但唔使\
去到成日轉場地咁誇張。",
    "dynamic": "呢條片可以郁動多啲——多個機位/位置轉換，甚至唔同場景（例如由室內轉去室外、由\
坐低轉去企定行動），配合多啲 B-roll 畫面，令條片睇落更有活力。",
}
_MOVEMENT_GUIDANCE_EN = {
    "static": "This video is filmed standing/sitting still, no movement — only 1-2 camera positions \
throughout (e.g. switching between \"close-up to camera\" and \"medium shot to camera\"). Don't \
suggest walking around or changing locations.",
    "walk": "This video can have some natural movement — e.g. talking while walking, or switching \
between 2-3 different angles/positions, but doesn't need constant location changes.",
    "dynamic": "This video can have a lot of movement — multiple camera positions/locations, even \
different settings (e.g. indoor to outdoor, sitting to standing/walking), paired with more B-roll \
footage for an energetic feel.",
}
_DEFAULT_MOVEMENT = "walk"


def _movement_line(movement: str, is_zh: bool) -> str:
    table = _MOVEMENT_GUIDANCE_ZH if is_zh else _MOVEMENT_GUIDANCE_EN
    return table.get(movement, table[_DEFAULT_MOVEMENT])


_SYSTEM_ZH_TEMPLATE = """你要幫一個香港保險從業員/KOL 度一條短片嘅「台詞連分鏡表」，題材係用戶\
俾嘅一個方向/主題。目標格式：直度短片（9:16），總長大約 25-45 秒（用真人正常語速講出嚟嘅長度\
嚟計）。

呢個唔係兩份獨立文件（唔係得個劇本，都唔係得個分鏡表），而係一份對齊咗嘅表：每一個 beat 都\
有自己嘅鏡頭資訊（望鏡頭定 B-roll、景別/角度）+ 呢一刻講緊嘅對白。

{movement_line}

建議敘事結構（有效嘅招募/心態類短片普遍咁樣鋪排，唔係硬性模板，方向本身唔啱就唔使跟）：
1. 開場鈎子——一條有反差感嘅問題或者反常識嘅講法，唔好由自我介紹或者背景交代開始。
2. 張力/對比——擺出兩種心態、兩種做法，或者一個普遍誤解 vs 事實嘅落差。
3. 具體嘅洞察或者證據——一個實在、貼地嘅講法去解開上面嘅張力（唔好編造用戶方向入面冇出現過\
嘅具體數字/年資）。
4. 反思提問——一兩句簡短反問句，引導觀眾自己諗返自己嘅處境。
5. 收尾——自然、唔強銷嘅一句，方向本身有要求先加 CTA。

望鏡頭 (talking_head) 同 B-roll 交替出現，B-roll 用嚟畀觀眾睇到對白入面提到嘅嘢（例如：\
處理文書、開會、同同事傾偈），內容要具體（例如「B-roll：處理文書」），唔好淨係寫「插入相關\
畫面」。B-roll 嘅 dialogue 可以延續緊之前望鏡頭嗰段嘅對白（畫外音），或者留空（純畫面停頓）。

如果下面有提供「最新資訊」，內容可以用返呢啲真實資料，唔好夾雜錯誤或者過時嘅資料；冇提供\
就用返你自己知道嘅嘢寫一個通用啲嘅方案，唔好編造具體數字/日期扮真實。

硬性要求：
1. 4-8 個 beat，每個都要有：label（例如「機位一」「機位二」「B-roll」）、kind（"talking_head"\
或者 "broll"）、shot_type（景別/角度，例如「近鏡，人望鏡頭」；B-roll 就寫實際畫面內容，例如\
「處理文書」）、dialogue（呢個 beat 講緊嘅字句，可以留空）。
2. 寫真係會講出口嘅口語，唔係書面文章讀出嚟——短句、自然停頓（用換行分段代表停頓位）。
3. 只用繁體字，唔可以出現簡體字。
4. 用香港口語（「嘅」「啦」「咁」「唔」「佢」等），專業術語用香港講法（供款、保單、受保人）。
5. 唔好用破折號（—）。
6. 諗一個吸引嘅標題（好似「轉行前先小心呢個心態！」咁，有反差感/引起好奇心，唔使成句講晒重點）。

只輸出 JSON，不要 markdown，不要任何說明文字：
{{"title": "標題", "beats": [{{"label": "機位一", "kind": "talking_head", \
"shot_type": "近鏡，人望鏡頭", "dialogue": "..."}}], "estimated_duration_seconds": 30}}"""

_SYSTEM_EN_TEMPLATE = """Write a combined "script + shot list" for a Hong Kong insurance-agent KOL's \
short video, on a direction/topic the user gives you. Target format: vertical short video (9:16), \
roughly 25-45 seconds total (measured by natural speaking pace).

This is not two separate documents (not just a script, not just a shot list) — it's one aligned \
table: each "beat" has its own shot info (talking to camera, or B-roll — framing/angle) plus the \
words being said during that beat.

{movement_line}

Suggested narrative arc (this is the shape effective recruitment/mindset shorts tend to follow — a \
guideline, not a rigid template):
1. Hook — open with a question or counter-intuitive statement, never a self-introduction.
2. Tension/contrast — two mindsets, two approaches, or a misconception vs. reality.
3. A concrete insight or proof point that resolves that tension (never invent specific numbers/years \
not implied by the direction).
4. Reflection questions — one or two short rhetorical questions.
5. Close — natural, not hard-sell; only add a CTA if the direction calls for one.

Talking-head and B-roll beats alternate — B-roll shows the viewer what the dialogue is describing \
(e.g. doing paperwork, a team meeting, chatting with colleagues), and should be specific (e.g. \
"B-roll: doing paperwork"), not a vague "insert relevant footage." A B-roll beat's dialogue can \
continue the narration from the talking-head beat before it (voiceover), or be empty (a pure visual \
beat).

If "current information" is provided below, the content can reference those real facts; don't mix in \
wrong or outdated information. If none is provided, use general knowledge — never invent specific \
numbers/dates to sound authoritative.

Hard requirements:
1. 4-8 beats, each with: label (e.g. "Shot 1", "Shot 2", "B-roll"), kind ("talking_head" or \
"broll"), shot_type (framing/angle, e.g. "Close-up, facing camera"; for B-roll, the actual footage \
content, e.g. "Doing paperwork"), dialogue (the words said during this beat — can be empty).
2. Write words a real person would actually SAY — short sentences, natural pauses (line breaks).
3. No em dashes (—).
4. Come up with a punchy title (like "Think twice before switching careers!" — something with a \
hook/curiosity gap, not a full summary of the content).

Output ONLY valid JSON, no markdown, no explanation:
{{"title": "the title", "beats": [{{"label": "Shot 1", "kind": "talking_head", \
"shot_type": "Close-up, facing camera", "dialogue": "..."}}], "estimated_duration_seconds": 30}}"""


_CONTINUE_ZH_TEMPLATE = """你要延續一份已經開始咗嘅短片「台詞連分鏡表」——唔係由頭寫過，而係接住\
落尾一個 beat 自然噉寫多幾個。

{movement_line}

已經有嘅 beats（按次序）：
{existing_beats_block}

方向/主題：{direction}

要求：
1. 加多 3-5 個新 beat，接住上面最後一個 beat 嘅語氣同內容自然噉延續落去——加多啲具體例子、\
細節或者另一個角度，唔好重複已經寫咗嘅嘢，唔好由自我介紹或者開場鈎子嗰種嘢再嚟一次。
2. 如果上面已經有收尾感覺嘅句子，可以當佢係中段，加多啲料先至再收多次尾；如果仲未收尾，噉呢批\
新 beat 應該帶到去一個自然、唔強銷嘅收尾。
3. 望鏡頭 (talking_head) 同 B-roll 交替出現，B-roll 內容要具體，dialogue 可以延續之前望鏡頭\
嗰段嘅對白（畫外音），或者留空。
4. 寫真係會講出口嘅口語，短句、自然停頓（用換行分段代表停頓位），只用繁體字，唔可以出現簡體字，\
用香港口語，唔好用破折號（—）。

只輸出 JSON，不要 markdown，不要任何說明文字：
{{"beats": [{{"label": "機位三", "kind": "talking_head", "shot_type": "近鏡，人望鏡頭", \
"dialogue": "..."}}], "estimated_duration_seconds": 10}}"""

_CONTINUE_EN_TEMPLATE = """You're continuing a short video "script + shot list" that's already \
underway — not starting over, just writing a few more beats picking up right after the last one.

{movement_line}

Beats so far (in order):
{existing_beats_block}

Direction/topic: {direction}

Requirements:
1. Add 3-5 new beats that continue naturally from the tone and content of the last beat above — \
more concrete examples, detail, or another angle. Don't repeat what's already there, and don't \
re-do a self-introduction or opening hook.
2. If the beats above already felt like a close, treat that as the middle and add more substance \
before closing again; if they didn't close yet, these new beats should land on a natural, \
not-hard-sell close.
3. Talking-head and B-roll beats alternate, B-roll content should be specific, and its dialogue can \
continue the narration from the talking-head beat before it (voiceover) or be empty.
4. Write words a real person would actually SAY — short sentences, natural pauses (line breaks), no \
em dashes (—).

Output ONLY valid JSON, no markdown, no explanation:
{{"beats": [{{"label": "Shot 3", "kind": "talking_head", "shot_type": "Close-up, facing camera", \
"dialogue": "..."}}], "estimated_duration_seconds": 10}}"""


def _clean_beats(raw) -> list:
    out = []
    for b in raw or []:
        if not isinstance(b, dict):
            continue
        label = str(b.get("label", "")).strip()
        shot_type = str(b.get("shot_type", "")).strip()
        dialogue = str(b.get("dialogue", "")).strip()
        if not label and not shot_type and not dialogue:
            continue
        kind = str(b.get("kind", "")).strip().lower()
        if kind not in ("talking_head", "broll"):
            kind = "talking_head"
        out.append({
            "label": label or f"Shot {len(out) + 1}",
            "kind": kind,
            "shot_type": shot_type,
            "dialogue": dialogue,
        })
    return out[:_MAX_BEATS]


def generate_combined_script(direction: str, movement: str = _DEFAULT_MOVEMENT, lang: str = "zh") -> Optional[dict]:
    """方向/主题 + movement -> 一份台詞連分鏡表（beats，機位/B-roll 同對白對齊）。
    失敗一律返回 None，不編假結果——跟呢個代碼庫其餘生成式功能同一個約定。"""
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

    template = _SYSTEM_ZH_TEMPLATE if is_zh else _SYSTEM_EN_TEMPLATE
    system_prompt = template.format(movement_line=_movement_line(movement, is_zh))

    raw = call_llm_chat(system_prompt, context_block, temperature=0.8)
    if raw is None:
        logger.info("combined_script: 没配 LLM 或调用失败，跳过")
        return None

    parsed = extract_json(raw)
    if parsed is None:
        logger.warning(f"combined_script: JSON 解析失敗，原始響應: {raw[:300]!r}")
        return None

    beats = _clean_beats(parsed.get("beats"))
    if not beats:
        return None
    title = str(parsed.get("title", "")).strip()
    if is_zh:
        title = to_traditional(title)
        for b in beats:
            b["label"] = to_traditional(b["label"])
            b["shot_type"] = to_traditional(b["shot_type"])
            b["dialogue"] = to_traditional(b["dialogue"])

    try:
        duration = float(parsed.get("estimated_duration_seconds"))
    except (TypeError, ValueError):
        duration = None

    return {
        "title": title,
        "beats": beats,
        "estimated_duration_seconds": duration,
        "sources": ctx["sources"] if ctx else [],
        "grounded": bool(ctx and ctx["sources"]),
    }


def _format_existing_beats(beats: list, is_zh: bool) -> str:
    lines = []
    for i, b in enumerate(beats, start=1):
        kind_label = ("B-roll" if b.get("kind") == "broll" else ("望鏡頭" if is_zh else "Talking head"))
        shot_type = str(b.get("shot_type") or "").strip()
        dialogue = str(b.get("dialogue") or "").strip()
        head = f"{i}. [{b.get('label', '')} · {kind_label}" + (f" · {shot_type}" if shot_type else "") + "]"
        lines.append(f"{head} {dialogue}" if dialogue else head)
    return "\n".join(lines)


def generate_more_beats(
    direction: str, movement: str, lang: str, existing_beats: list
) -> Optional[dict]:
    """接住已經有嘅 beats 尾嗰個，再攞 3-5 個新 beat 延續落去（唔係由頭生成）。
    失敗一律返回 None——同 generate_combined_script 一樣嘅約定，唔編假結果。"""
    direction = (direction or "").strip()
    existing_beats = [b for b in (existing_beats or []) if isinstance(b, dict)]
    if not direction or not existing_beats:
        return None

    # Room left before hitting the overall cap — never generates more than
    # this regardless of what the model returns.
    room = _MAX_BEATS - len(existing_beats)
    if room <= 0:
        return None

    is_zh = lang != "en"
    template = _CONTINUE_ZH_TEMPLATE if is_zh else _CONTINUE_EN_TEMPLATE
    system_prompt = template.format(
        movement_line=_movement_line(movement, is_zh),
        existing_beats_block=_format_existing_beats(existing_beats, is_zh),
        direction=direction,
    )

    raw = call_llm_chat(system_prompt, direction, temperature=0.8)
    if raw is None:
        logger.info("combined_script(more): 没配 LLM 或调用失败，跳过")
        return None

    parsed = extract_json(raw)
    if parsed is None:
        logger.warning(f"combined_script(more): JSON 解析失敗，原始響應: {raw[:300]!r}")
        return None

    beats = _clean_beats(parsed.get("beats"))[:room]
    if not beats:
        return None
    if is_zh:
        for b in beats:
            b["label"] = to_traditional(b["label"])
            b["shot_type"] = to_traditional(b["shot_type"])
            b["dialogue"] = to_traditional(b["dialogue"])

    try:
        duration = float(parsed.get("estimated_duration_seconds"))
    except (TypeError, ValueError):
        duration = None

    return {"beats": beats, "estimated_duration_seconds": duration}
