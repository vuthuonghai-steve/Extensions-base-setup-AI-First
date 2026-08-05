"""Contract tests cho gate_traceid.py (G1-07, PostToolUse backstop).

Luôn stdout {}; quyết định (error/info) chỉ nằm trong wide-event log JSONL.
Gate bị skip bởi matcher -> {} và KHÔNG có log line.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = SCRIPTS_DIR / "post_tool_use" / "gate_traceid.py"

CONTRACT_FILE = "0_contracts/ipc-payloads.ts"


def edit_payload(target_file: str, tool_name: str = "write_to_file") -> dict:
    """Payload PostToolUse cho tool file-edit."""
    return {
        "stepIdx": 3,
        "conversationId": "test-conv-traceid",
        "workspacePaths": [],
        "transcriptPath": "/tmp/fake/transcript.jsonl",
        "artifactDirectoryPath": "/tmp/fake/artifacts",
        "toolCall": {"name": tool_name, "args": {"TargetFile": target_file, "CodeContent": ""}},
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
        timeout=30,
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


def make_contract_file(tmp_path: Path, content: str) -> None:
    """Tạo file contract trong repo giả."""
    path = tmp_path / CONTRACT_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_error_when_traceid_optional(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """traceId? xuất hiện -> stdout {} + log decision "error"."""
    make_contract_file(tmp_path, "interface IpcPayload {\n  traceId?: string;\n}\n")

    proc = run_gate(edit_payload(CONTRACT_FILE), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["gate_id"] == "G1-07"
    assert logs[0]["rule_id"] == "OBS-2"
    assert logs[0]["event_dir"] == "post_tool_use"
    assert logs[0]["hook_event"] == "PostToolUse"
    assert logs[0]["decision"] == "error"
    assert "traceId bị optional" in logs[0]["reason"]
    assert "OBS-2" in logs[0]["reason"]
    assert logs[0]["target_file"] == CONTRACT_FILE
    assert logs[0]["tool_name"] == "write_to_file"
    assert logs[0]["step_idx"] == 3


def test_info_when_traceid_required(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """traceId: (không optional) -> stdout {} + log decision "info"."""
    make_contract_file(tmp_path, "interface IpcPayload {\n  traceId: string;\n}\n")

    proc = run_gate(edit_payload(CONTRACT_FILE), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "info"


def test_info_when_contract_file_missing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """File contract không tồn tại -> stdout {} + log "info" skipped."""
    proc = run_gate(edit_payload(CONTRACT_FILE), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "info"
    assert "file missing" in logs[0]["reason"]


def test_skipped_when_target_file_not_contract(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """TargetFile không phải ipc-payloads.ts -> {} và KHÔNG có log line."""
    (tmp_path / "src").mkdir(parents=True)
    (tmp_path / "src" / "other.ts").write_text("traceId?: string\n", encoding="utf-8")

    proc = run_gate(edit_payload("src/other.ts"), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}
    assert read_log_lines(tmp_path) == []


def test_skipped_when_tool_not_edit(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Tool không phải file-edit -> {} và KHÔNG có log line."""
    make_contract_file(tmp_path, "traceId?: string\n")

    proc = run_gate(edit_payload(CONTRACT_FILE, tool_name="run_command"), tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == {}
    assert read_log_lines(tmp_path) == []
