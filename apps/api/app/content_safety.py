"""C-roll 照片上传前的内容安全预检——只查"这张照片能不能被当作数字人形象素材
提交给 HeyGen"，不是通用内容审核。

背景（真实事故，2026-08-12，见 phase2_video_pipeline_plan.md 的 2c 段落）：
测试时用了 `~/video-studio/raw_demo1/` 里的一帧,单看文件夹名以为是真人口播
demo,实际是儿童课堂录像的一帧,已经发到 HeyGen 的 API 才被对方自己的内容
过滤器拦下（没有生成视频）。HeyGen 那次确实兜住了,但：
1. 干等它们的过滤器命中,用户要等上传+HeyGen排队的时间才知道被拒,体验差；
2. 第三方过滤器覆盖面是黑盒,不能假设它总能命中我们在意的每一类问题；
3. 更重要的是人的习惯问题——这次是"看文件夹名猜内容",不会永远只犯这一种
   错误。加一层自己的检查,把"人工看一眼再传"变成"系统兜底看一眼再传"。

设计原则，跟 qa_stills.py 的 _vision_review 同一个模式：
- 用 call_vision_chat（VISION_LLM_*），未配置/调用失败/解析失败时返回
  "无法判断"而不是抛异常——参考 llm_client.call_vision_chat 自己的说明
  "调用方按'没有眼睛'跳过，不影响主流程"。这里刻意选择 fail-open（看不了
  就放行,不因为视觉服务不可用而挡住所有 C-roll 上传——跟 croll_script.py
  2026-08-11 那次"不能让 C-roll 依赖视觉服务可用性"的教训是同一个原则，
  只是应用到了審核这一步而不是文案生成那一步),真正命中"不安全"时才拦。
- 只检查这一张身份照片本身,不检查 hint 文本、不检查 b-roll（b-roll 是
  单独的素材,不冒充数字人身份,风险模型不同,不在这次范围内）。
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)

_PROMPT = """你在审核一张即将提交给数字人生成服务（HeyGen）的身份照片——这张照片会被用来
生成一个"数字人开口说话"的商业营销视频。判断这张照片是否适合这个用途。

明确不适合、必须拒绝的情况：
- 儿童/未成年人是照片的主体（无论场景，课堂/家庭/户外都算——这类照片不该被
  用来生成数字人营销视频，不管拍摄意图是什么）
- 裸露、性暗示内容
- 暴力、血腥、令人不安的画面
- 仇恨符号/极端主义标志

不算问题、应该放行的情况：
- 成年人的日常照片，哪怕背景杂乱、光线一般、不是专业头像
- 照片里没有清晰人脸（这是"生成效果可能不好"的问题，不是安全问题，交给
  HeyGen 自己的生成流程去处理，这里不做画质判断）

只输出 JSON，不要多余文字：{"safe": true/false, "reason": "一句话说明判断依据"}"""


class SafetyCheckResult(NamedTuple):
    safe: bool          # True = 放行（含"无法判断,按放行处理"的情况）
    checked: bool        # False = 视觉服务不可用/调用失败，没能真的看一眼
    reason: str


def check_photo_safety(photo_path: str | Path) -> SafetyCheckResult:
    """看一眼这张 C-roll 身份照片，判断能不能提交给 HeyGen。

    永远不抛异常——任何失败都归为"没能检查，放行"，调用方不需要额外
    try/except。真正会挡的只有视觉 LLM 明确给出 safe:false 的情况。
    """
    path = Path(photo_path)
    if not path.exists():
        return SafetyCheckResult(safe=True, checked=False, reason="文件不存在，跳过检查")

    try:
        from .llm_client import call_vision_chat

        raw = call_vision_chat(_PROMPT, [str(path)], timeout=30)
        if not raw:
            logger.info("content_safety: 视觉 LLM 未配置或调用失败，跳过 C-roll 照片安全检查（fail-open）")
            return SafetyCheckResult(safe=True, checked=False, reason="视觉服务不可用，未检查")

        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned[cleaned.find("{"):cleaned.rfind("}") + 1]
        data = json.loads(cleaned)
        safe = bool(data.get("safe", True))
        reason = str(data.get("reason", ""))
        if not safe:
            logger.warning(f"content_safety: C-roll 照片被拦截 — {reason}")
        return SafetyCheckResult(safe=safe, checked=True, reason=reason)
    except Exception as e:
        # 解析失败/超时/任何意外——按 qa_stills._vision_review 同一个原则,
        # 记录下来但不让这一步的故障拖垮整条 C-roll 流程。
        logger.warning(f"content_safety: 安全检查异常（跳过，fail-open）: {e}")
        return SafetyCheckResult(safe=True, checked=False, reason=f"检查异常: {e}")
