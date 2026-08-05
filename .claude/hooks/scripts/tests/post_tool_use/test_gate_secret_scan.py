"""Contract tests cho gate_secret_scan.py (G1-08, PostToolUse backstop).

Luôn stdout {}; phát hiện secret sau lệnh build -> log decision "error".
Gate bị skip bởi matcher (không phải lệnh build) -> {} và KHÔNG có log line.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = SCRIPTS_DIR / "post_tool_use" / "gate_secret_scan.py"


def cmd_payload(command_line: str) -> dict:
    """Payload PostToolUse cho tool run_command."""
    return {
        "stepIdx": 4,
        "conversationId": "test-conv-secret",
        "workspacePaths": [],
        "transcriptPath": "/tmp/fake/transcript.jsonl",
        "artifactDirectoryPath": "/tmp/fake/artifacts",
        "toolCall": {"name": "run_command", "args": {"CommandLine": command_line, "Cwd": "/tmp/fake"}},
        "error": "",
    }


def run_gate(payload: dict, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> subprocess.CompletedProcess:
    """Chạy gate với payload JSON ở stdin; HOOK_REPO_ROOT = tmp_path."""
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    return subprocess.run(
        [sys.executable, str(GATE)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=SCRIPTS_DIR,
        timeout=60,
    )


def read_log_lines(tmp_path: Path) -> list[dict]:
    """Đọc mọi dòng JSONL trong <tmp>/.claude/hooks/logs/ (repo giả)."""
    log_dir = tmp_path / ".claude" / "hooks" / "logs"
    lines: list[dict] = []
    if not log_dir.is_dir():
        return lines
    for log_file in sorted(log_dir.glob("gates-*.jsonl")):
        for line in log_file.read_text(encoding="utf-8").splitlines():
            if line.strip():
                lines.append(json.loads(line))
    return lines


def make_dist_bundle(tmp_path: Path, content: str) -> None:
    """Tạo dist/bundle.js trong repo giả (giả lập output build)."""
    dist = tmp_path / "dist"
    dist.mkdir(parents=True, exist_ok=True)
    (dist / "bundle.js").write_text(content, encoding="utf-8")


def test_error_when_secret_in_dist(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Lệnh build + dist chứa secret -> stdout {} + log decision "error"."""
    make_dist_bundle(tmp_path, "const KEY = 'sk-abc123XYZsecret';\n")

    proc = run_gate(cmd_payload("wxt build"), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["gate_id"] == "G1-08"
    assert logs[0]["rule_id"] == "CFG-1"
    assert logs[0]["event_dir"] == "post_tool_use"
    assert logs[0]["hook_event"] == "PostToolUse"
    assert logs[0]["decision"] == "error"
    assert "Phát hiện" in logs[0]["reason"]
    assert "CFG-1" in logs[0]["reason"]
    assert logs[0]["tool_name"] == "run_command"


def test_info_when_build_without_secrets(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Lệnh build + dist sạch -> stdout {} + log decision "info"."""
    make_dist_bundle(tmp_path, "const x = 1;\n")

    proc = run_gate(cmd_payload("wxt build"), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "info"


def test_info_when_scan_path_missing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Lệnh build nhưng dist/ chưa tồn tại (skip missing) -> log "info"."""
    proc = run_gate(cmd_payload("wxt build"), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "info"


def test_skipped_when_command_not_build(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Lệnh không phải build -> {} và KHÔNG có log line."""
    make_dist_bundle(tmp_path, "sk-abc123XYZsecret\n")

    proc = run_gate(cmd_payload("npm test"), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}
    assert read_log_lines(tmp_path) == []
