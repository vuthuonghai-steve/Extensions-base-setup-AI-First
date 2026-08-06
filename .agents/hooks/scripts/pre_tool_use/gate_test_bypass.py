#!/usr/bin/env python3
"""G0-05 — Cấm bypass test/lint (Stage 5 must_not) trên CommandLine.

Regex trong rules["test_bypass"]["patterns"] (--no-verify, --skip-, [skip ci],
describe.only, it.only, test.skip) khớp lệnh shell → deny. Fail-open.
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules  # noqa: E402
from lib.hook_contract import emit, emit_allow, read_payload  # noqa: E402
from lib.logger import log_gate_decision  # noqa: E402

GATE_ID = "G0-05"
RULE_ID = "Stage-5"
EVENT_DIR = "pre_tool_use"
HOOK_EVENT = "PreToolUse"
FAIL_OPEN_DECISION = "allow"


def check(args: dict, rules: dict) -> tuple[str, str]:
    """Regex pattern nào khớp CommandLine → deny; còn lại allow."""
    command = str(args.get("CommandLine", ""))
    patterns = rules.get("test_bypass", {}).get("patterns", [])
    if not isinstance(patterns, list):
        return "allow", ""
    for pattern in patterns:
        pattern_str = str(pattern)
        try:
            if re.search(pattern_str, command):
                return "deny", f"BLOCKED: bypass test/lint bị cấm — {pattern_str}"
        except Exception:
            continue
    return "allow", ""


def main() -> None:
    """Đọc payload, chạy check, ghi log rồi emit đúng một JSON ra stdout."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    decision, reason = check(payload.args, rules)
    duration_ms = int((time.perf_counter() - start) * 1000)
    log_gate_decision(
        gate_id=GATE_ID,
        rule_id=RULE_ID,
        event_dir=EVENT_DIR,
        hook_event=HOOK_EVENT,
        decision=decision,
        reason=reason,
        target_file="",
        tool_name=payload.tool_name,
        conversation_id=payload.conversation_id,
        step_idx=payload.step_idx,
        duration_ms=duration_ms,
    )
    if decision == "allow":
        emit_allow(reason)
    else:
        emit(decision, reason)


if __name__ == "__main__":
    _start = time.perf_counter()
    try:
        main()
    except Exception as exc:  # fail-open: lỗi nội bộ không được chặn tool
        reason = f"gate internal error — fail-{FAIL_OPEN_DECISION}: {exc}"
        log_gate_decision(
            gate_id=GATE_ID,
            rule_id=RULE_ID,
            event_dir=EVENT_DIR,
            hook_event=HOOK_EVENT,
            decision=FAIL_OPEN_DECISION,
            reason=reason,
            duration_ms=int((time.perf_counter() - _start) * 1000),
        )
        emit_allow(reason)
