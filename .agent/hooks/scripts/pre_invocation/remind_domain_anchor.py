#!/usr/bin/env python3
"""G1-05 — Reminder Domain Anchor Doc mỗi phiên (PreInvocation, rule Stage-5).

Tìm Domain Anchor Doc (anchor_doc_paths rồi quét tên file *.md) và chèn
ephemeralMessage chống Semantic Drift. Không tìm thấy -> fail-open {}.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules, repo_root
from lib.hook_contract import HookPayload, emit_json, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G1-05"
RULE_ID = "Stage-5"
EVENT_DIR = "pre_invocation"
HOOK_EVENT = "PreInvocation"

_SKIP_DIRS = {
    "node_modules",
    ".git",
    ".agent",
    ".claude",
    ".cursor",
    ".gemini",
    "pencil",
    ".codegraph",
    ".local",
    ".omo",
    ".omc"
}
_ANCHOR_HINTS = ("domain-anchor", "anchor")
_MAX_SCAN_DEPTH = 4

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


def _scan_anchor(root: Path, max_depth: int = _MAX_SCAN_DEPTH) -> Path | None:
    """Quét repo (giới hạn độ sâu) tìm *.md có tên chứa "domain-anchor" hoặc "anchor".

    Bỏ qua node_modules/.git/.agent; duyệt BFS theo thứ tự tên để xác định.
    """
    root = root.resolve()
    queue: list[tuple[Path, int]] = [(root, 0)]
    while queue:
        current, depth = queue.pop(0)
        if depth > max_depth:
            continue
        try:
            entries = sorted(current.iterdir(), key=lambda p: p.name.lower())
        except OSError:
            continue
        for entry in entries:
            name = entry.name.lower()
            if entry.is_dir():
                if name not in _SKIP_DIRS:
                    queue.append((entry, depth + 1))
            elif entry.is_file() and entry.suffix.lower() == ".md":
                if any(hint in name for hint in _ANCHOR_HINTS):
                    return entry
    return None


def _find_anchor(root: Path, rules: dict) -> Path | None:
    """Tìm anchor doc: ưu tiên anchor_doc_paths trong rules, fallback quét."""
    candidates = rules.get("reminder", {}).get("anchor_doc_paths", []) or []
    for rel in candidates:
        candidate = root / str(rel)
        if candidate.is_file():
            return candidate
    return _scan_anchor(root)


def _log_decision(payload: HookPayload, *, decision: str, reason: str, target_file: str = "") -> None:
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
    """Chạy gate G1-05: đọc payload, tìm anchor, emit injectSteps hoặc {}."""
    payload = read_payload()
    rules = load_rules()
    root = repo_root()

    anchor = _find_anchor(root, rules)
    if anchor is None:
        _emit({})
        _log_decision(payload, decision="allow", reason="no anchor doc found (fail-open)")
        return

    rel = anchor.relative_to(root)
    message = (
        f"📌 Domain Anchor: {rel}. Đọc lại trước khi tiếp tục "
        "để chống Semantic Drift (AGENTS.md Stage 5)."
    )
    _emit({"injectSteps": [{"ephemeralMessage": message}]})
    _log_decision(
        payload,
        decision="inject",
        reason=f"reminder sent: {rel}",
        target_file=str(rel),
    )


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
