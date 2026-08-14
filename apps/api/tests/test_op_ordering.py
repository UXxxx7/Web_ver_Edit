#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regression: insert_broll must run before apply_style.

apply_style renders graphic cards onto the video; insert_broll's cutaway then
overlays the b-roll full-canvas on top. If apply_style runs first, a card
scheduled during a b-roll window is occluded and only its tail is visible —
the "card flashes for ~1s right after the b-roll" bug. This locks in the fix
in pipeline_runner._order_broll_before_style.

Runs standalone (`python tests/test_op_ordering.py`) or under pytest. Only
depends on that one pure helper.
"""
import os
import sys

# make `app` importable when run directly from apps/api or its tests/ dir
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.pipeline_runner import _order_broll_before_style  # noqa: E402


def _types(ops):
    return [o.get("type") for o in ops]


def test_broll_appended_after_style_is_moved_before_it():
    # the exact user scenario: a good styled edit, then a b-roll appended later
    ops = [{"type": "apply_style"}, {"type": "insert_broll", "items": []}]
    assert _types(_order_broll_before_style(ops)) == ["insert_broll", "apply_style"]


def test_already_correct_order_is_untouched():
    ops = [{"type": "insert_broll"}, {"type": "apply_style"}]
    assert _types(_order_broll_before_style(ops)) == ["insert_broll", "apply_style"]


def test_no_apply_style_is_noop():
    ops = [{"type": "remove_filler"}, {"type": "insert_broll"}]
    assert _types(_order_broll_before_style(ops)) == ["remove_filler", "insert_broll"]


def test_no_broll_is_noop():
    ops = [{"type": "remove_filler"}, {"type": "apply_style"}]
    assert _types(_order_broll_before_style(ops)) == ["remove_filler", "apply_style"]


def test_other_ops_keep_their_slots():
    # remove_filler stays first; only the late insert_broll hops before apply_style
    ops = [
        {"type": "remove_filler"},
        {"type": "apply_style"},
        {"type": "color_grade"},
        {"type": "insert_broll"},
    ]
    assert _types(_order_broll_before_style(ops)) == [
        "remove_filler",
        "insert_broll",
        "apply_style",
        "color_grade",
    ]


def test_multiple_brolls_preserve_relative_order():
    a = {"type": "insert_broll", "items": [{"asset_ref": 0}]}
    b = {"type": "insert_broll", "items": [{"gen_prompt": "x"}]}
    ops = [{"type": "apply_style"}, a, b]
    out = _order_broll_before_style(ops)
    assert _types(out) == ["insert_broll", "insert_broll", "apply_style"]
    assert out[0] is a and out[1] is b  # order among moved b-rolls preserved


def test_does_not_mutate_input_list():
    ops = [{"type": "apply_style"}, {"type": "insert_broll"}]
    original = list(ops)
    _order_broll_before_style(ops)
    assert ops == original  # returns a new list, input untouched


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok   {name}")
            except AssertionError as e:
                failures += 1
                print(f"  FAIL {name}: {e}")
    print(f"\n{'PASS' if not failures else f'{failures} FAILED'}")
    sys.exit(1 if failures else 0)
