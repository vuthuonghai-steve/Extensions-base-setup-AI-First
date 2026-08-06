#!/usr/bin/env python3
"""Gate G2-01..04: bằng chứng giai đoạn (deploy, usability, monitoring, legal).

Chỉ enforce khi activation_doc tồn tại và chứa activation_marker ("GO");
ngược lại → "allow" (chưa qua Stage 4 — không chặn việc giai đoạn sớm).
Fail-open: lỗi không xác định → "allow".
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.config import load_rules, repo_root
from lib.hook_contract import HookPayload, emit, emit_allow, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G2-01..04"
RULE_ID = "Stage-5/6/7/8, GRD-1"

_MAX_SEARCH_DEPTH = 6
_SKIP_DIRS = {"node_modules", "dist"}
_CONFIG_EXTS = (".json", ".yaml", ".yml", ".ts")


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


def _read_text(path: Path) -> str:
    """Đọc text file fail-safe; lỗi/thiếu → chuỗi rỗng."""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _check_deploy(transcript_path: str, patterns: list[str]) -> str | None:
    """Thiếu bằng chứng deploy/staging trong transcript → mô tả lỗi."""
    if not transcript_path:
        return "thiếu bằng chứng deploy/staging"
    text = _read_text(Path(transcript_path))
    if not text or not any(p in text for p in patterns):
        return "thiếu bằng chứng deploy/staging"
    return None


def _check_usability(repo: Path, report_path: str, min_percent: int) -> str | None:
    """Usability report thiếu hoặc dưới ngưỡng % hoàn thành → mô tả lỗi."""
    text = _read_text(repo / report_path)
    if not text:
        return "usability report thiếu con số hoàn thành"
    percents = [int(match) for match in re.findall(r"(\d{2,3})\s*%", text)]
    if not any(p >= min_percent for p in percents):
        return f"usability report dưới {min_percent}% hoàn thành"
    return None


def _is_config_file(name: str) -> bool:
    """File cấu hình: .json/.yaml/.yml/.ts và tên chứa config/sentry, hoặc package.json."""
    lower = name.lower()
    if lower == "package.json":
        return True
    return lower.endswith(_CONFIG_EXTS) and ("config" in lower or "sentry" in lower)


def _check_monitoring(repo: Path, patterns: list[str]) -> str | None:
    """Thiếu cấu hình monitoring (depth giới hạn, bỏ node_modules/dist) → mô tả lỗi."""
    root_depth = len(repo.parts)
    for dirpath, dirnames, filenames in os.walk(repo):
        depth = len(Path(dirpath).parts) - root_depth
        if depth >= _MAX_SEARCH_DEPTH:
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for fname in filenames:
            if not _is_config_file(fname):
                continue
            if any(p in _read_text(Path(dirpath) / fname) for p in patterns):
                return None
    return "thiếu cấu hình monitoring"


def _check_legal(repo: Path, keywords: list[str]) -> str | None:
    """Không doc *.md nào chứa keyword pháp lý (không phân biệt hoa thường) → mô tả lỗi."""
    for md in repo.rglob("*.md"):
        if "node_modules" in md.parts:
            continue
        text = _read_text(md).lower()
        if any(keyword.lower() in text for keyword in keywords):
            return None
    return "thiếu bằng chứng legal (ToS/Privacy chưa duyệt)"


def main() -> None:
    """Kiểm activation guard + 4 bằng chứng; log wide event; emit JSON."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    repo = repo_root()
    ev = rules["evidence"]

    activation = _read_text(repo / ev["activation_doc"])
    if activation and ev.get("activation_marker", "GO") in activation:
        failures: list[str] = []
        deploy_fail = _check_deploy(
            payload.transcript_path or "", ev.get("deploy_patterns", [])
        )
        if deploy_fail:
            failures.append(deploy_fail)
        usability_fail = _check_usability(
            repo, ev["usability_report_path"], int(ev.get("usability_min_percent", 80))
        )
        if usability_fail:
            failures.append(usability_fail)
        monitoring_fail = _check_monitoring(repo, ev.get("monitoring_patterns", []))
        if monitoring_fail:
            failures.append(monitoring_fail)
        legal_fail = _check_legal(repo, ev.get("legal_keywords", []))
        if legal_fail:
            failures.append(legal_fail)

        if failures:
            decision = "continue"
            reason = "Thiếu bằng chứng giai đoạn: " + "; ".join(failures)
        else:
            decision = "allow"
            reason = ""
    else:
        decision = "allow"
        reason = "Chưa qua Stage 4 — bỏ qua evidence check"

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
