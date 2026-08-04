#!/usr/bin/env python3
"""Gate G0-06 (rule Stage-5 must_not): không tin báo cáo "đã xong" chưa verify.

Nếu lượt sửa file cuối cùng trong transcript chưa có lệnh test/lint/typecheck
chạy sau nó → "continue" để ép Agent verify cơ học trước khi dừng.
Fail-open: transcript thiếu/hỏng → "allow".
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.checks.transcript import last_edit_needs_verify
from lib.config import load_rules
from lib.hook_contract import HookPayload, emit, emit_allow, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G0-06"
RULE_ID = "Stage-5 must_not"

_DEFAULT_VERIFY_PATTERNS = [
    "test", "lint", "typecheck", "tsc", "vitest", "pytest", "eslint",
]


def _log_decision(
    payload: HookPayload | None, decision: str, reason: str, duration_ms: int
) -> None:
    """Ghi wide event log duy nhất trước khi emit (logging-best-practices)."""
    log_gate_decision(
        gate_id=GATE_ID,
        rule_id=RULE_ID,
        event_dir="stop",
        hook_event="Stop",
        decision=decision,
        reason=reason,
        target_file="",
        tool_name="",
        conversation_id=getattr(payload, "conversation_id", "") if payload else "",
        step_idx=getattr(payload, "step_idx", -1) if payload else -1,
        duration_ms=duration_ms,
    )


def main() -> None:
    """Kiểm transcript lượt cuối; log wide event; emit JSON quyết định."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    verify_patterns = rules.get("verify_patterns") or _DEFAULT_VERIFY_PATTERNS
    result = last_edit_needs_verify(payload.transcript_path, verify_patterns)

    if result["needs_verify"]:
        decision = "continue"
        reason = (
            "Code vừa sửa chưa chạy test/lint — cần verify cơ học trước khi "
            f"dừng (G0-06). {result.get('reason', '')}"
        )
    else:
        decision = "allow"
        reason = ""

    duration_ms = int((time.perf_counter() - start) * 1000)
    _log_decision(payload, decision, reason, duration_ms)
    if decision == "continue":
        emit("continue", reason)
    elif reason:
        emit_allow(reason)
    else:
        emit_allow()


if __name__ == "__main__":
    start = time.perf_counter()
    try:
        main()
    except Exception as exc:
        try:
            payload = read_payload()
        except Exception:
            payload = None
        duration_ms = int((time.perf_counter() - start) * 1000)
        reason = f"Gate {GATE_ID} lỗi — fail-open: {exc}"
        _log_decision(payload, "allow", reason, duration_ms)
        emit_allow(reason)
