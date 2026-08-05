#!/usr/bin/env python3
"""Gate G1-01..04: cổng cấu trúc tài liệu (Negative Space, MoSCoW, Anchor, ADR).

Chặn Agent dừng khi tài liệu giai đoạn thiếu cấu trúc bắt buộc. Check nào
thiếu file đích → skipped (bỏ qua im lặng). Fail-open: lỗi → "allow".
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.checks.doc_structure import (
    check_adr,
    check_domain_anchor,
    check_moscow,
    check_negative_space,
)
from lib.config import load_rules, repo_root
from lib.hook_contract import HookPayload, emit, emit_allow, read_payload
from lib.logger import log_gate_decision

GATE_ID = "G1-01..04"
RULE_ID = "DES-1/NEG-1, Stage-2, VAL-3/Stage-1, DES-3/Stage-3"


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


def _describe(name: str, result: dict, doc: dict) -> str:
    """Chuyển kết quả check thành mô tả vi phạm đọc được cho con người."""
    if name == "Negative Space":
        found = result.get("found")
        if found is not None:
            min_items = doc.get("negative_space_min_items", 5)
            return f"Negative Space chỉ {found}/{min_items} mục"
        return "Negative Space chưa đạt"
    if name == "MoSCoW":
        found = result.get("found")
        if found is not None:
            max_must_have = doc.get("moscow_must_have_max", 5)
            return f"MoSCoW có {found} must-have (tối đa {max_must_have})"
        return "MoSCoW chưa đạt"
    if name == "Domain Anchor":
        missing = result.get("missing") or []
        if missing:
            return f"Domain Anchor thiếu: {', '.join(missing)}"
        return "Domain Anchor chưa đạt"
    if name == "ADR":
        missing = result.get("missing_constraints") or []
        if missing:
            return f"ADR thiếu phần Constraints: {', '.join(missing)}"
        return f"ADR trống ({result.get('adr_count', 0)} file)"
    return "chưa đạt"


def _run_checks(repo: Path, rules: dict) -> list[tuple[str, dict]]:
    """Chạy 4 check cấu trúc; trả [(tên check, kết quả)]."""
    doc = rules["doc_structure"]
    checks: list[tuple[str, dict]] = [
        ("Negative Space", check_negative_space(repo / doc["negative_space_path"], rules)),
        ("MoSCoW", check_moscow(repo / doc["moscow_path"], rules)),
        ("ADR", check_adr(repo / doc["adr_dir"], rules)),
    ]
    anchor = next(
        (repo / path for path in doc["anchor_doc_paths"] if (repo / path).exists()),
        None,
    )
    if anchor is not None:
        checks.append(("Domain Anchor", check_domain_anchor(anchor, rules)))
    return checks


def main() -> None:
    """Chạy 4 check cấu trúc; log wide event; emit JSON quyết định."""
    start = time.perf_counter()
    payload = read_payload()
    rules = load_rules()
    doc = rules["doc_structure"]

    failures = [
        _describe(name, result, doc)
        for name, result in _run_checks(repo_root(), rules)
        if not result.get("ok") and not result.get("skipped")
    ]
    if failures:
        decision = "continue"
        reason = "Thiếu sót cổng tài liệu: " + "; ".join(failures)
    else:
        decision = "allow"
        reason = ""

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
