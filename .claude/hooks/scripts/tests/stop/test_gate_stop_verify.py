"""Contract tests cho gate_stop_verify.py (G0-06, rule Stage-5 must_not).

Fake transcript.jsonl: {"toolCall": {"name": "...", "args": {...}}} mỗi dòng.
Chạy gate qua subprocess với JSON payload trên stdin (cwd = scripts dir).
"""

import datetime
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = "stop/gate_stop_verify.py"

PAYLOAD = {
    "conversationId": "conv-stop-verify",
    "stepIdx": 5,
    "terminationReason": "Stop",
    "fullyIdle": True,
}


def make_transcript(tmp_path: Path, entries: list[dict]) -> Path:
    """Ghi transcript.jsonl (1 JSON object mỗi dòng)."""
    path = tmp_path / "transcript.jsonl"
    path.write_text(
        "\n".join(json.dumps(entry, ensure_ascii=False) for entry in entries) + "\n",
        encoding="utf-8",
    )
    return path


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
    assert record["gate_id"] == "G0-06"
    return out


def test_edit_followed_by_test_allows(tmp_path, monkeypatch) -> None:
    """File-edit rồi chạy test sau đó → allow."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    transcript = make_transcript(
        tmp_path,
        [
            {"toolCall": {"name": "write_to_file", "args": {"TargetFile": "src/a.ts"}}},
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "npm test"}}},
        ],
    )
    out = run_gate(tmp_path, {**PAYLOAD, "transcriptPath": str(transcript)})
    assert out["decision"] == "allow"


def test_edit_without_test_continues(tmp_path, monkeypatch) -> None:
    """File-edit không kèm lệnh test/lint sau đó → continue."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    transcript = make_transcript(
        tmp_path,
        [{"toolCall": {"name": "write_to_file", "args": {"TargetFile": "src/a.ts"}}}],
    )
    out = run_gate(tmp_path, {**PAYLOAD, "transcriptPath": str(transcript)})
    assert out["decision"] == "continue"
    assert "verify" in out["reason"]


def test_missing_transcript_allows(tmp_path, monkeypatch) -> None:
    """Transcript không tồn tại → fail-open allow."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    out = run_gate(
        tmp_path, {**PAYLOAD, "transcriptPath": str(tmp_path / "nonexistent.jsonl")}
    )
    assert out["decision"] == "allow"
