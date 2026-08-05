"""Contract tests cho gate_doc_structure.py (G1-01..04).

Fake repo trong tmp_path theo đường dẫn rules.yaml (docs/negative-space.md,
docs/decisions/adr...). Check nào thiếu file đích → skipped im lặng.
"""

import datetime
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = "stop/gate_doc_structure.py"

PAYLOAD = {
    "conversationId": "conv-doc-structure",
    "stepIdx": 7,
    "terminationReason": "Stop",
    "fullyIdle": True,
    "transcriptPath": "",
}


def run_gate(repo_root: Path, payload: dict) -> dict:
    """Chạy gate qua subprocess; verify stdout + log đều có ĐÚNG 1 dòng."""
    proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / GATE)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(SCRIPTS_DIR),
        timeout=120,
    )
    assert proc.returncode == 0, f"exit={proc.returncode} stderr={proc.stderr}"
    out = json.loads(proc.stdout)  # lỗi nếu stdout có >1 JSON object

    log_file = (
        repo_root / ".claude" / "hooks" / "logs"
        / f"gates-{datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")}.jsonl"
    )
    assert log_file.is_file(), f"thiếu wide event log: {log_file}"
    lines = [line for line in log_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1, f"mong đợi 1 log line, thấy {len(lines)}: {lines}"
    record = json.loads(lines[0])
    assert record["conversation_id"] == payload.get("conversationId", "")
    assert record["decision"] == out["decision"]
    assert record["gate_id"] == "G1-01..04"
    return out


def test_negative_space_short_continues(tmp_path, monkeypatch) -> None:
    """Negative Space chỉ 2 mục → continue, reason nhắc Negative Space."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "negative-space.md").write_text("- Mục 1\n- Mục 2\n", encoding="utf-8")
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "continue"
    assert "Negative Space" in out["reason"]


def test_negative_space_complete_allows(tmp_path, monkeypatch) -> None:
    """Đủ 6 mục kèm hậu quả → allow (các doc khác thiếu → skipped)."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    docs = tmp_path / "docs"
    docs.mkdir()
    bullets = "\n".join(f"- Mục {i}: hậu quả {i}" for i in range(1, 7))
    (docs / "negative-space.md").write_text(bullets + "\n", encoding="utf-8")
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "allow"


def test_adr_without_constraints_continues(tmp_path, monkeypatch) -> None:
    """ADR tồn tại nhưng thiếu phần Constraints → continue."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    adr = tmp_path / "docs" / "decisions" / "adr"
    adr.mkdir(parents=True)
    (adr / "0001-stack.md").write_text(
        "# ADR 1\n## Decision\nDùng WXT cho extension.\n", encoding="utf-8"
    )
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "continue"
