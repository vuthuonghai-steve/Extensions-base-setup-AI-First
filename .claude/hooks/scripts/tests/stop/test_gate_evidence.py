"""Contract tests cho gate_evidence.py (G2-01..04).

Activation guard: chỉ enforce khi docs/decisions/viability-gate.md chứa "GO".
Fake repo trong tmp_path; chạy gate qua subprocess (cwd = scripts dir).
"""

import datetime
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = "stop/gate_evidence.py"

PAYLOAD = {
    "conversationId": "conv-evidence",
    "stepIdx": 9,
    "terminationReason": "Stop",
    "fullyIdle": True,
    "transcriptPath": "",
}

_EVIDENCE_KEYWORDS = ("deploy", "usability", "monitoring", "legal")


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
    assert record["gate_id"] == "G2-01..04"
    return out


def make_activation(repo_root: Path) -> None:
    """Tạo GO doc — kích hoạt evidence gate."""
    decisions = repo_root / "docs" / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "viability-gate.md").write_text("# Viability Gate\nGO\n", encoding="utf-8")


def test_activation_not_met_allows(tmp_path, monkeypatch) -> None:
    """Chưa có viability-gate.md → chưa qua Stage 4, bỏ qua evidence → allow."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    (tmp_path / "src").mkdir()
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "allow"


def test_active_no_evidence_continues(tmp_path, monkeypatch) -> None:
    """Activation đạt nhưng thiếu mọi bằng chứng → continue (có keyword)."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    make_activation(tmp_path)
    out = run_gate(tmp_path, PAYLOAD)
    assert out["decision"] == "continue"
    lowered = out["reason"].lower()
    assert any(keyword in lowered for keyword in _EVIDENCE_KEYWORDS)


def test_active_full_evidence_allows(tmp_path, monkeypatch) -> None:
    """Đủ 4 bằng chứng (deploy + 85% + sentry + human-reviewed) → allow."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    make_activation(tmp_path)

    transcript = tmp_path / "transcript.jsonl"
    transcript.write_text(
        '{"toolCall":{"name":"run_command","args":{"CommandLine":"npm run deploy"}}}\n',
        encoding="utf-8",
    )
    (tmp_path / "docs" / "validation-report.md").write_text(
        "Hoàn thành core flow: 85%\n", encoding="utf-8"
    )
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "sentry.json").write_text(
        '{"dsn": "sentry://fake-key"}\n', encoding="utf-8"
    )
    (tmp_path / "docs" / "privacy.md").write_text(
        "ToS đã được human-reviewed duyệt.\n", encoding="utf-8"
    )

    out = run_gate(tmp_path, {**PAYLOAD, "transcriptPath": str(transcript)})
    assert out["decision"] == "allow"
