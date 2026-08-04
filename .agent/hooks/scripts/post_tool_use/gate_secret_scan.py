#!/usr/bin/env python3
"""G1-08 — Backstop secret/API key trong dist/ sau build (PostToolUse, rule CFG-1).

Sau lệnh build, quét các scan_paths tìm pattern secret (regex IGNORECASE)
và ghi wide-event log cảnh báo. PostToolUse KHÔNG thể chặn -> luôn emit {};
CI là lớp chặn chính.
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules, repo_root
from lib.hook_contract import HookPayload, emit_json, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G1-08"
RULE_ID = "CFG-1"
EVENT_DIR = "post_tool_use"
HOOK_EVENT = "PostToolUse"

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


def _is_build_cmd(command_line: str, patterns: list) -> bool:
    """Lệnh build: chứa bất kỳ pattern nào (substring, case-insensitive)."""
    lowered = command_line.lower()
    return any(str(p).lower() in lowered for p in (patterns or []))


def _scan_for_secrets(root: Path, scan_paths: list, patterns: list) -> list[dict]:
    """Quét từng scan_paths (bỏ qua thư mục missing) tìm pattern secret.

    Trả về danh sách [{"file", "line", "match"}] theo thứ tự xác định.
    """
    regexes = [re.compile(str(p), re.IGNORECASE) for p in (patterns or [])]
    hits: list[dict] = []
    for rel in scan_paths or []:
        base = root / str(rel)
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            try:
                lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
            except OSError:
                continue
            for lineno, line in enumerate(lines, start=1):
                for rx in regexes:
                    match = rx.search(line)
                    if match is not None:
                        hits.append(
                            {
                                "file": str(path.relative_to(root)),
                                "line": lineno,
                                "match": match.group(0),
                            }
                        )
                        break
    return hits


def _log_decision(payload: HookPayload, *, decision: str, reason: str) -> None:
    """Ghi 1 wide-event log duy nhất cho lần gate này (canonical line)."""
    log_gate_decision(
        gate_id=GATE_ID,
        rule_id=RULE_ID,
        event_dir=EVENT_DIR,
        hook_event=HOOK_EVENT,
        decision=decision,
        reason=reason,
        target_file="",
        tool_name=payload.tool_name or "",
        conversation_id=payload.conversation_id or "",
        step_idx=payload.step_idx if isinstance(payload.step_idx, int) else 0,
        duration_ms=_duration_ms(),
    )


def main() -> None:
    """Chạy gate G1-08: matcher run_command + lệnh build, quét dist tìm secret."""
    payload = read_payload()
    rules = load_rules()
    root = repo_root()

    tool_name = payload.tool_name or ""
    args = payload.args or {}
    command_line = str(args.get("CommandLine") or "")
    build_patterns = rules.get("secret", {}).get("build_cmd_patterns", [])

    # Matcher: tool run_command VÀ CommandLine là lệnh build
    if tool_name != "run_command" or not _is_build_cmd(command_line, build_patterns):
        _emit({})
        return  # gate skipped — không ghi log

    hits = _scan_for_secrets(root, rules.get("secret", {}).get("scan_paths", []), rules.get("secret", {}).get("patterns", []))
    if hits:
        _emit({})
        _log_decision(
            payload,
            decision="error",
            reason=f"Phát hiện {len(hits)} secret trong dist/ — CFG-1 vi phạm, CI sẽ fail",
        )
        return

    _emit({})
    _log_decision(payload, decision="info", reason="clean: không có secret trong dist/")


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
