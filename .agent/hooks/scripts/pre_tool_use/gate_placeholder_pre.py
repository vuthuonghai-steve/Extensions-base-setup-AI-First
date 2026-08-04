#!/usr/bin/env python3
"""G0-01 — Zero Placeholder (BQD-2/ZPL-1) trước khi ghi file.

Quét CodeContent (write_to_file), ReplacementContent (replace_file_content)
và mọi giá trị chuỗi trong ReplacementChunks (multi_replace_file_content);
nếu còn TODO/mock data/lorem ipsum → deny. Fail-open khi lỗi nội bộ.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.checks import placeholder  # noqa: E402
from lib.config import load_rules  # noqa: E402
from lib.hook_contract import emit, emit_allow, read_payload  # noqa: E402
from lib.logger import log_gate_decision  # noqa: E402

GATE_ID = "G0-01"
RULE_ID = "BQD-2/ZPL-1"
EVENT_DIR = "pre_tool_use"
HOOK_EVENT = "PreToolUse"
FAIL_OPEN_DECISION = "allow"


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
    """Scan placeholder trong mọi content; trả (decision, reason)."""
    findings: list[tuple[int, str]] = []
    for content in collect_contents(args):
        for item in placeholder.scan_text(content, rules):
            pair = (int(item["line"]), str(item["match"]))
            if pair not in findings:
                findings.append(pair)
    if not findings:
        return "allow", ""
    lines = [f"line {line}: {match}" for line, match in findings]
    reason = "; ".join(lines) + " — Zero Placeholder policy — BQD-2/ZPL-1"
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
