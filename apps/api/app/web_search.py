# WhatsApp MVP - 极简 Google Search grounding 检索工具，给 content_idea.py/
# shooting_script.py/video_script.py 这几个"方向 -> 生成内容"的 brainstorm
# 工具共用。
#
# 抽成公用模块而不是像 social_batch.py/social_caption.py 那样各自复制一份
# _to_traditional/OpenCC 那种小助手——那是"卫星模块之间不互相 reach into
# 对方下划线开头 private helper"的既有约定，这里不适用：这是一开始就设计
# 给多个调用方共用的公开工具（跟 llm_client.py 是同一个性质），不是从某个
# 内容生成模块里挖出来的私有实现细节。
#
# 极简 prompt，不带任何文风/格式规则——content_idea.py 实测过的真实教训：
# 检索工具跟一长串格式铁律混进同一次调用，模型经常整个跳过搜索。生成阶段
# （文风/格式）是调用方自己的事，这里只负责"查返资讯，简短总结"。

from __future__ import annotations

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_SEARCH_DEADLINE_S = 30


def _gemini_key() -> str:
    # 优先用专门给检索用的 key（可指向独立配额），依次回退到项目里其它地方
    # 已经在用的 Gemini key——跟 style_reference_analyzer.py 的
    # STYLEREF_GEMINI_KEY 回退链同一个思路。
    return (os.getenv("CONTENT_IDEA_GEMINI_KEY") or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY") or os.getenv("VISION_LLM_API_KEY", ""))


def _extract_sources(candidate: dict) -> list:
    """Google Search grounding 的引用来源——groundingMetadata.groundingChunks[].web.
    {uri,title}。没走检索这个 key 就不存在，返回空列表（= 纯模型知识，没有
    实时检索支撑），调用方据此展示"有没有真的查过资料"这个诚实信号。"""
    try:
        chunks = (candidate.get("groundingMetadata") or {}).get("groundingChunks") or []
    except Exception:
        return []
    sources = []
    for c in chunks:
        web = (c or {}).get("web") or {}
        uri = web.get("uri")
        if uri:
            sources.append({"uri": uri, "title": web.get("title") or uri})
    return sources[:5]


def search_context(query: str, lang: str = "zh") -> Optional[dict]:
    """极简检索调用，返回 {"summary": str, "sources": [...]} 或 None（没配 key/
    调用失败/没查到任何内容）。调用方把 None 当"没有额外资讯可用"处理，不是
    致命错误——每个调用方自己决定检索失败时要不要退回纯模型知识继续生成。"""
    key = _gemini_key()
    if not key:
        return None
    model = os.getenv("CONTENT_IDEA_MODEL", "gemini-flash-latest")
    base = os.getenv("STYLEREF_GEMINI_BASE", "https://generativelanguage.googleapis.com").rstrip("/")
    url = f"{base}/v1beta/models/{model}:generateContent"
    prompt = (f"搜索關於呢個主題最新、最相關嘅資訊，簡短總結（3-5句），列出關鍵事實：{query}"
              if lang != "en" else
              f"Search for the latest, most relevant information about this topic and briefly "
              f"summarize the key facts (3-5 sentences): {query}")
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
    }
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    try:
        r = requests.post(url, json=body, headers=headers, timeout=_SEARCH_DEADLINE_S)
        r.raise_for_status()
        data = r.json()
        candidate = data["candidates"][0]
        summary = "".join(p.get("text", "") for p in candidate["content"]["parts"] if "text" in p)
    except Exception as e:
        logger.info(f"web_search: 检索调用失败/跳过，退回纯模型知识: {e}")
        return None
    if not summary.strip():
        return None
    return {"summary": summary.strip(), "sources": _extract_sources(candidate)}
