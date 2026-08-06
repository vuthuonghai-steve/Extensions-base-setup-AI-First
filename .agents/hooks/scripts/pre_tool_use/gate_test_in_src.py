#!/usr/bin/env python3
"""G1-09 — Cấm file test trong src/ (test placement).

Mọi test bắt buộc nằm trong tests/ (Architect §4 tree; testing-and-verification
§3) — file *.test.ts / *.spec.ts ghi vào src/ bị deny, kèm path đúng.

Không scan nội dung — chỉ check TargetFile path của 3 tool file-edit.
Fail-open: lỗi nội bộ không được chặn tool.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules  # noqa: E402
from lib.hook_contract import emit, emit_allow, read_payload  # noqa: E402
from lib.logger import log_gate_decision  # noqa: E402

GATE_ID = "G1-09"
RULE_ID = "TST-PLACEMENT"
EVENT_DIR = "pre_tool_use"
HOOK_EVENT = "PreToolUse"
FAIL_OPEN_DECISION = "allow"
REASON_SUFFIX = " — testing-and-verification §3"

TEST_FILE_SUFFIXES = (".test.ts", ".spec.ts")

def is_test_file(path: str) -> bool:
    """True nếu path là file test theo đuôi file (.test.ts / .spec.ts)."""
    return path.endswith(TEST_FILE_SUFFIXES)

def is_inside_src(path: str) -> bool:
    """True nếu path nằm dưới thư mục src/ (segment chính xác, không phải substring)."""
    return "src" in Path(path).parts

def check(args: dict, rules: dict) -> tuple[str, str]:
    """Kiểm tra target file; trả (decision, reason)."""
    target_file = str(args.get("TargetFile", ""))
    if target_file == "":
        return "allow", ""
    # Fail-safe: thiếu config test_placement → không chặn (không mặc định scan)
    placement = rules.get("test_placement", {})
    if not isinstance(placement, dict) or "scan_paths" not in placement:
        return "allow", ""
    scan_paths = placement.get("scan_paths", [])
    scanned = any("src" in Path(p).parts for p in scan_paths)
    if not scanned:
        return "allow", ""
    if is_inside_src(target_file) and is_test_file(target_file):
        tests_root = placement.get("tests_root", "tests/unit/")
        reason = (
            f"BLOCKED: test file trong src/ không được phép — "
            f"{target_file} → đặt tại {tests_root} (Architect §4 tree)"
        )
        return "deny", reason
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
