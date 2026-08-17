"""L1.5 fallback planner.

worker.py's _run_llm_planner() tries the L2 agent planner
(agent_editor.plan_video) first, and on any exception (LLM API down,
rate-limited, timed out — all observed in practice against Gemini) falls
back to `from .llm_planner import plan_edit`. That import target never
existed anywhere in this repo's history — every L2 failure crashed the
whole job with ModuleNotFoundError instead of degrading gracefully.

Deterministic on purpose, no LLM call: since the reason we're here is the
LLM path just failed, a fallback that also calls an LLM could fail the
same way. Reuses the same safe default operation set
agent_editor._default_plan() uses for its own "L2 kept returning empty
plans" floor, rather than inventing a different one — that set is already
manifest-aware (only includes ops whose required tools are actually
available) and exercised by the main planning path.
"""
from __future__ import annotations

from .agent_editor import allowed_ops, allowed_tools_from_manifest, load_manifest

# Mirrors agent_editor._default_plan() — duplicated rather than importing
# a leading-underscore name from another module.
_FALLBACK_OP_ORDER = ("remove_filler", "remove_silences", "add_subtitles")


def plan_edit(request: str) -> dict:
    """Return a plan compatible with agent_editor.plan_video's documented
    contract: {edit_operations, summary, edit_decisions, review_findings}.
    """
    manifest = load_manifest()
    supported = set(allowed_ops(allowed_tools_from_manifest(manifest)))

    edit_operations = [{"type": t} for t in _FALLBACK_OP_ORDER if t in supported]
    if not edit_operations:
        edit_operations = [{"type": "remove_silences"}]  # 极端兜底：至少去个静音

    summary = "AI 詳細規劃暫時無法使用，改用基本清理方案（去口誤 / 靜音"
    summary += "、加字幕" if any(op["type"] == "add_subtitles" for op in edit_operations) else ""
    summary += "）。"
    if request:
        summary += f" 原本要求：{request}"

    return {
        "edit_operations": edit_operations,
        "summary": summary,
        "edit_decisions": [],
        "review_findings": [],
    }
