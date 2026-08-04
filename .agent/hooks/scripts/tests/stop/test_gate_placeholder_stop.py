"""Contract tests cho gate_placeholder_stop.py (G0-02, rule BQD-2/ZPL-1).

Chạy gate qua subprocess với JSON payload trên stdin (cwd = scripts dir),
dựng fake repo trong tmp_path qua HOOK_REPO_ROOT.
"""

import datetime
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = "stop/gate_placeholder_stop.py"

PAYLOAD = {
    "conversationId": "conv-placeholder-stop",
    "stepIdx": 3,
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
        repo_root / ".agent" / "hooks" / "logs"
        / f"gates-{datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")}.jsonl"
    )
    assert log_file.is_file(), f"thiếu wide event log: {log_file}"
    lines = [line for line in log_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1, f"mong đợi 1 log line, thấy {len(lines)}: {lines}"
    record = json.loads(lines[0])
    assert record["conversation_id"] == payload.get("conversationId", "")
    assert record["decision"] == out["decision"]
    assert record["gate_id"] == "G0-02"
    return out


def test_todo_in_src_forces_continue(tmp_path, monkeypatch) -> None:
    """Repo còn TODO trong src/ → continue, reason nhắc placeholder."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.ts").write_text("export const x = 1; // TODO: fix later\n")
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "continue"
    assert "placeholder" in out["reason"].lower()
    assert "a.ts" in out["reason"]


def test_clean_repo_allows(tmp_path, monkeypatch) -> None:
    """Repo sạch placeholder → allow."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.ts").write_text("export const x = 1;\n")
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "allow"
