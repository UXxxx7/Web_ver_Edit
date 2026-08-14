#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""L1.5 规划兜底 —— L2(agent_editor.plan_video)失败时的确定性安全网。

历史事故(2026-08-14, job_ef464fd2937e 及同类):Gemini 503/读超时 → Arm B 落穿
→ L2 规划器(走 agent_editor 自己的 requests.post)又撞 503 → 原设计里"回退
L1.5"这一步 `from .llm_planner import plan_edit` 因为本模块从 WhatsApp 版迁移时
漏移植、根本不存在 → ModuleNotFoundError → 整单硬 ERROR、用户看到红字。也就是一个
**本可恢复的上游临时抖动被翻译成了硬失败**(见 worker.py 的两处调用点:
_run_llm_planner 初次规划、revise_plan 按反馈重规划)。

本模块补上这个缺失的兜底层:此刻上游多半正挂着,再调任何 LLM 都是白搭,所以
**不调 LLM**,直接返回一份**确定性的安全默认方案**——与零指令任务的默认一致
(remove_filler → apply_style:先去口误,再出模板样式片)。apply_style / insert_broll
等重量级算子在管线里本身可降级(pipeline_runner._DEGRADABLE_OPS),所以即使此刻连
模板渲染也拿不到 LLM,最坏也只是降级交付一版剪好的视频,而不是给用户一个红叉。

契约:返回 dict {summary, edit_operations}(见 worker._send_confirmation 的消费方式)。
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 零指令默认方案(与 agent_editor SYSTEM_BASE 的默认一致):先去口误,再套模板样式。
_DEFAULT_OPERATIONS = [{"type": "remove_filler"}, {"type": "apply_style"}]


def plan_edit(request: str, video_duration: Optional[float] = None) -> dict:
    """L2 规划失败时的确定性兜底方案。不调 LLM,直接给安全默认方案。

    request / video_duration 目前不参与决策——此刻通常正处于上游不可用状态,任何
    再依赖 LLM 的"智能"兜底都不可靠;保留入参是为了匹配两个调用点的契约,并给将来
    "离线也能按关键词粗排"留扩展位。
    """
    logger.warning(
        "llm_planner(L1.5 兜底):L2 规划不可用,回退确定性默认方案 "
        "[remove_filler, apply_style](请求=%r);上游恢复后用户 retry 可拿到完整规划。",
        (request or "")[:80],
    )
    return {
        "summary": "剪辑规划服务暂时不可用,已按默认方案先出一版(去口误 + 套用模板样式)。"
                   "可稍后重试以获取更贴合你要求的方案。",
        # 拷贝一份,避免调用方就地修改污染模块级常量。
        "edit_operations": [dict(op) for op in _DEFAULT_OPERATIONS],
    }
