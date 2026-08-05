#!/usr/bin/env python3
"""G0-03 — Contract Lock (DES-2) trước khi sửa data contract.

TargetFile thuộc protected_dirs (vd 0_contracts/) → force_ask để người duyệt
từng lần, bỏ qua Always Allow. FAIL-CLOSED: mọi lỗi nội bộ → force_ask.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules  # noqa: E402
from lib.hook_contract import emit, read_payload  # noqa: E402
from lib.logger import log_gate_decision  # noqa: E402

GATE_ID = "G0-03"
RULE_ID = "DES-2"
EVENT_DIR = "pre_tool_use"
HOOK_EVENT = "PreToolUse"
FAIL_OPEN_DECISION = "force_ask"
DENY_REASON = (
    "AI đang sửa data contract trong 0_contracts/ — cần người duyệt (DES-2). "
    "Bỏ qua Always Allow."
)


def check(args: dict, rules: dict) -> tuple[str, str]:
    """TargetFile chứa protected_dirs → force_ask; còn lại allow."""
    target_file = str(args.get("TargetFile", ""))
    section = rules.get("contract_lock", {})
    protected = section.get("protected_dirs", [])
    if isinstance(protected, list):
        for protected_dir in protected:
            if str(protected_dir) in target_file:
                return "force_ask", DENY_REASON
    return "allow", ""


def main() -> None:
    """Đọc payload, chạy check, ghi log rồi emit đúng một JSON ra stdout."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    target_file = str(payload.args.get("TargetFile", ""))
    decision, reason = check(payload.args, rules)
    duration_ms = int((time.perf_counter() - start) * 1000)
    log_gate_decision(
        gate_id=GATE_ID,
        rule_id=RULE_ID,
        event_dir=EVENT_DIR,
        hook_event=HOOK_EVENT,
        decision=decision,
        reason=reason,
        target_file=target_file,
        tool_name=payload.tool_name,
        conversation_id=payload.conversation_id,
        step_idx=payload.step_idx,
        duration_ms=duration_ms,
    )
    emit(decision, reason)


if __name__ == "__main__":
    _start = time.perf_counter()
    try:
        main()
    except Exception as exc:  # fail-closed: contract lock không bao giờ tự mở
        reason = f"gate internal error — fail-closed (DES-2): {exc}"
        log_gate_decision(
            gate_id=GATE_ID,
            rule_id=RULE_ID,
            event_dir=EVENT_DIR,
            hook_event=HOOK_EVENT,
            decision=FAIL_OPEN_DECISION,
            reason=reason,
            duration_ms=int((time.perf_counter() - _start) * 1000),
        )
        emit(FAIL_OPEN_DECISION, reason)
