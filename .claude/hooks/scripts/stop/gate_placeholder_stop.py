#!/usr/bin/env python3
"""Gate G0-02 (rule BQD-2/ZPL-1): quét toàn repo tìm placeholder trước khi dừng.

Nếu scan_paths (src/) còn TODO/FIXME/placeholder → quyết định "continue"
để ép Agent xử lý; sạch → "allow". Fail-open: lỗi không xác định → "allow".
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.checks.placeholder import scan_repo
from lib.config import load_rules, repo_root
from lib.hook_contract import HookPayload, emit, emit_allow, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G0-02"
RULE_ID = "BQD-2/ZPL-1"


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
    """Scan repo tìm placeholder; log wide event; emit JSON quyết định."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    violations = scan_repo(repo_root(), rules)

    if violations:
        file_count = len({v["file"] for v in violations})
        examples = "; ".join(
            f"{v['file']}:{v['line']} {v['match']}" for v in violations[:5]
        )
        decision = "continue"
        reason = (
            f"Còn {len(violations)} placeholder ({file_count} file) — "
            f"Zero Placeholder policy BQD-2/ZPL-1 chưa đạt. Vd: {examples}"
        )
    else:
        decision = "allow"
        reason = "Full-repo placeholder scan sạch"

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
