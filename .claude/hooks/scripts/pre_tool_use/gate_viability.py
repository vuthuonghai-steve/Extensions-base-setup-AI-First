#!/usr/bin/env python3
"""G0-04 — MVP Viability Gate (Stage 4, Human-only) trước khi viết code.

TargetFile nằm trong protected_code_paths → bắt buộc gate doc
(docs/decisions/viability-gate.md) đã chứa marker GO; thiếu → deny.
File ngoài code path → allow. Fail-open khi lỗi nội bộ.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules, repo_root  # noqa: E402
from lib.hook_contract import emit, emit_allow, read_payload  # noqa: E402
from lib.logger import log_gate_decision  # noqa: E402

GATE_ID = "G0-04"
RULE_ID = "Stage-4"
EVENT_DIR = "pre_tool_use"
HOOK_EVENT = "PreToolUse"
FAIL_OPEN_DECISION = "allow"


def _gate_doc_ok(gate_path: Path, go_marker: str) -> bool:
    """Gate doc tồn tại VÀ chứa marker GO."""
    if not gate_path.is_file():
        return False
    try:
        return go_marker in gate_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return False


def check(args: dict, rules: dict, repo: Path) -> tuple[str, str]:
    """Code path mà chưa có GO trong gate doc → deny; còn lại allow."""
    target_file = str(args.get("TargetFile", ""))
    viability = rules.get("viability", {})
    protected = viability.get("protected_code_paths", [])
    if isinstance(protected, list) and any(str(p) in target_file for p in protected):
        gate_doc = str(viability.get("gate_doc", ""))
        gate_path = repo / gate_doc if gate_doc else repo
        if not _gate_doc_ok(gate_path, str(viability.get("go_marker", ""))):
            reason = (
                "MVP Viability Gate chưa PASS — không được viết code "
                f"(Stage 4 Human-only). Thiếu GO trong {gate_path}"
            )
            return "deny", reason
    return "allow", ""


def main() -> None:
    """Đọc payload, chạy check, ghi log rồi emit đúng một JSON ra stdout."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    target_file = str(payload.args.get("TargetFile", ""))
    decision, reason = check(payload.args, rules, repo_root())
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
