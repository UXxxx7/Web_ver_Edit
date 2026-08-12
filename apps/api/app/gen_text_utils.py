# WhatsApp MVP - 小工具集，给 content_idea.py/shooting_script.py/video_script.py
# 这几个"方向 -> brainstorm 内容"生成器共用：简体转繁体安全网、从 LLM 原始
# 响应文本里摘取 JSON。理由跟 web_search.py 同一条——这是三个调用方从一开始
# 就共用的通用小工具，不是从某一个生成模块里挖出来的私有实现细节，不违反
# "卫星模块不互相 reach into 对方 private helper" 那条既有约定。

from __future__ import annotations

import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# 只用繁體字是硬性要求，光靠 prompt 管不住——真实教训（job_4e8504467ab6 抓到过
# 模型混入简体字）。产出前统一过一遍简转繁做机械防线。s2t（通用简转繁）而不是
# s2hk（香港政府官方字形表）——两者对同一批字给出不同字形，s2t 更贴近日常
# 实际打字/口语习惯用的字形，这几个生成器的产物都是给人直接用的文本。
try:
    from opencc import OpenCC
    _S2T_CONVERTER: Optional["OpenCC"] = OpenCC("s2t")
except Exception as e:
    logger.warning(f"gen_text_utils: OpenCC 初始化失败，简转繁安全网关闭: {e}")
    _S2T_CONVERTER = None


def to_traditional(text: str) -> str:
    if _S2T_CONVERTER is None:
        return text
    try:
        return _S2T_CONVERTER.convert(text)
    except Exception as e:
        logger.warning(f"gen_text_utils: 简转繁调用失败，放行原文: {e}")
        return text


def extract_json(text: str) -> Optional[dict]:
    """从 LLM 原始响应文本里摘取第一个 {...} JSON 对象——这几个生成器都不用
    强制 JSON 模式（web_search.py 头部注释解释过：跟 tools:[google_search]
    同时启用会互斥/影响检索），只能靠 prompt 要求 + 这里宽松解析。"""
    text = (text or "").strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, dict) else None
    except Exception:
        return None
