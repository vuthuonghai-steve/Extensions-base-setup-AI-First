#!/usr/bin/env python3
"""G1-07 — Backstop traceId bắt buộc trong IPC payload (PostToolUse, rule OBS-2).

Sau khi sửa 0_contracts/ipc-payloads.ts, kiểm tra field traceId không bị
optional (traceId?). PostToolUse KHÔNG thể chặn -> luôn emit {}; quyết định
chỉ ghi wide-event log (type checker là lớp chặn chính).
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules, repo_root
from lib.hook_contract import HookPayload, emit_json, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G1-07"
RULE_ID = "OBS-2"
EVENT_DIR = "post_tool_use"
HOOK_EVENT = "PostToolUse"

_EDIT_HINTS = ("write", "replace", "edit")

_START: float = time.perf_counter()
_EMITTED: bool = False


def _duration_ms() -> int:
    """Thời gian chạy gate tính từ lúc process start (ms)."""
    return round((time.perf_counter() - _START) * 1000)


def _emit(obj: dict) -> None:
    """Emit đúng MỘT object JSON ra stdout (contract bắt buộc)."""
    global _EMITTED
    emit_json(obj)
    _EMITTED = True


def _is_edit_tool(tool_name: str) -> bool:
    """Tool file-edit: tên chứa "write"/"replace"/"edit" (case-insensitive)."""
    lowered = tool_name.lower()
    return any(hint in lowered for hint in _EDIT_HINTS)


def _log_decision(payload: HookPayload, *, decision: str, reason: str, target_file: str) -> None:
    """Ghi 1 wide-event log duy nhất cho lần gate này (canonical line)."""
    log_gate_decision(
        gate_id=GATE_ID,
        rule_id=RULE_ID,
        event_dir=EVENT_DIR,
        hook_event=HOOK_EVENT,
        decision=decision,
        reason=reason,
        target_file=target_file,
        tool_name=payload.tool_name or "",
        conversation_id=payload.conversation_id or "",
        step_idx=payload.step_idx if isinstance(payload.step_idx, int) else 0,
        duration_ms=_duration_ms(),
    )


def main() -> None:
    """Chạy gate G1-07: matcher file-edit + TargetFile, scan nội dung thật."""
    payload = read_payload()
    rules = load_rules()
    root = repo_root()

    tool_name = payload.tool_name or ""
    args = payload.args or {}
    target_file = str(args.get("TargetFile") or "")
    contract_file = str(rules.get("traceid", {}).get("target_file") or "0_contracts/ipc-payloads.ts")

    # Matcher: tool file-edit VÀ TargetFile trỏ đúng file contract
    if not (_is_edit_tool(tool_name) and target_file.endswith(contract_file)):
        _emit({})
        return  # gate skipped — không ghi log

    path = root / target_file
    if not path.is_file():
        _emit({})
        _log_decision(payload, decision="info", reason=f"skipped: file missing {target_file}", target_file=target_file)
        return

    content = path.read_text(encoding="utf-8", errors="replace")
    optional_regex = str(rules.get("traceid", {}).get("optional_regex") or r"traceId\s*\?")
    if re.search(optional_regex, content) is not None:
        _emit({})
        _log_decision(
            payload,
            decision="error",
            reason=f"traceId bị optional trong {target_file} — OBS-2 vi phạm, type checker sẽ fail build",
            target_file=target_file,
        )
        return

    _emit({})
    _log_decision(payload, decision="info", reason=f"traceId OK trong {target_file}", target_file=target_file)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # fail-open: không bao giờ crash / stdout hỏng
        if not _EMITTED:
            emit_json({})
        log_gate_decision(
            gate_id=GATE_ID,
            rule_id=RULE_ID,
            event_dir=EVENT_DIR,
            hook_event=HOOK_EVENT,
            decision="allow",
            reason=f"gate error (fail-open): {exc}",
            target_file="",
            tool_name="",
            conversation_id="",
            step_idx=0,
            duration_ms=_duration_ms(),
        )
