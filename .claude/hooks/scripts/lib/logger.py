"""Wide-event logger cho mọi quyết định gate (logging-best-practices).

Một gate emit ĐÚNG MỘT canonical log line JSONL mỗi lần quyết định;
không in gì ra stdout, không bao giờ raise khi ghi log thất bại.
"""

import datetime
import json
import os

from .config import repo_root

_LOG_DIR_REL = ".claude/hooks/logs"
_LEVEL_ERROR_DECISIONS = {"deny", "force_ask", "continue"}


def log_gate_decision(
    *,
    gate_id: str,
    rule_id: str,
    event_dir: str,
    hook_event: str,
    decision: str,
    reason: str = "",
    target_file: str = "",
    tool_name: str = "",
    conversation_id: str = "",
    step_idx: int | None = None,
    duration_ms: int | None = None,
) -> None:
    """Ghi 1 dòng JSON (append-only) vào logs/gates-YYYY-MM-DD.jsonl.

    Schema wide event cố định: hook_gate_decision + business context
    (gate_id/rule_id) + environment context (commit_hash) + timestamp UTC.
    """
    try:
        logs_dir = repo_root() / _LOG_DIR_REL
        logs_dir.mkdir(parents=True, exist_ok=True)

        now = datetime.datetime.now(datetime.timezone.utc)
        log_path = logs_dir / "gates-{}.jsonl".format(now.strftime("%Y-%m-%d"))

        record = {
            "event": "hook_gate_decision",
            "gate_id": gate_id,
            "rule_id": rule_id,
            "event_dir": event_dir,
            "hook_event": hook_event,
            "tool_name": tool_name,
            "target_file": target_file,
            "decision": decision,
            "reason": reason,
            "conversation_id": conversation_id,
            "step_idx": step_idx,
            "duration_ms": duration_ms,
            "timestamp": now.isoformat(),
            "commit_hash": os.environ.get("GIT_COMMIT", "unknown"),
            "level": "error" if decision in _LEVEL_ERROR_DECISIONS else "info",
        }
        with open(log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        return
