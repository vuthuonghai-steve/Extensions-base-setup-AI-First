#!/usr/bin/env python3
"""G1-06 — Ranh giới kiến trúc 5 tầng (OBS-1/ARC-1..3/TYP-1).

Scan nội dung sắp ghi (cùng 3 tool file-edit như G0-01) qua
boundaries.scan_arch: console.log trần, as any, chrome/dom trong 3_modules/,
postMessage ngoài bridge, import ngược tầng → deny. Fail-open.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.checks import boundaries  # noqa: E402
from lib.config import load_rules  # noqa: E402
from lib.hook_contract import emit, emit_allow, read_payload  # noqa: E402
from lib.logger import log_gate_decision  # noqa: E402

GATE_ID = "G1-06"
RULE_ID = "OBS-1/ARC-1/ARC-2/ARC-3/TYP-1"
EVENT_DIR = "pre_tool_use"
HOOK_EVENT = "PreToolUse"
FAIL_OPEN_DECISION = "allow"
REASON_SUFFIX = " — architecture-and-flow §3"


def _string_values(node: object) -> list[str]:
    """Gom mọi giá trị chuỗi trong cấu trúc lồng nhau (dict/list) của chunks."""
    values: list[str] = []
    if isinstance(node, str):
        values.append(node)
    elif isinstance(node, dict):
        for value in node.values():
            values.extend(_string_values(value))
    elif isinstance(node, list):
        for item in node:
            values.extend(_string_values(item))
    return values


def collect_contents(args: dict) -> list[str]:
    """Gom toàn bộ nội dung cần scan từ args của 3 tool file-edit."""
    contents: list[str] = []
    code = args.get("CodeContent")
    if isinstance(code, str):
        contents.append(code)
    replacement = args.get("ReplacementContent")
    if isinstance(replacement, str):
        contents.append(replacement)
    chunks = args.get("ReplacementChunks")
    if isinstance(chunks, list):
        contents.extend(_string_values(chunks))
    return contents


def check(args: dict, rules: dict) -> tuple[str, str]:
    """Scan ranh giới kiến trúc trên mọi content; trả (decision, reason)."""
    target_file = str(args.get("TargetFile", ""))
    details: list[str] = []
    for content in collect_contents(args):
        for item in boundaries.scan_arch(content, target_file, rules):
            detail = f"{item['kind']}: {item['match']} @line {item['line']}"
            if detail not in details:
                details.append(detail)
    if not details:
        return "allow", ""
    reason = "; ".join("BLOCKED: " + detail + REASON_SUFFIX for detail in details)
    return "deny", reason


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
