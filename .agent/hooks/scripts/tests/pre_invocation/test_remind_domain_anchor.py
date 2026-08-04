"""Contract tests cho remind_domain_anchor.py (G1-05, PreInvocation).

Chạy gate qua subprocess với payload JSON trên stdin (cwd = scripts/),
HOOK_REPO_ROOT trỏ tới repo giả trong tmp_path.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE = SCRIPTS_DIR / "pre_invocation" / "remind_domain_anchor.py"

PAYLOAD = {
    "invocationNum": 0,
    "initialNumSteps": 0,
    "conversationId": "test-conv-anchor",
    "workspacePaths": [],
    "transcriptPath": "/tmp/fake/transcript.jsonl",
    "artifactDirectoryPath": "/tmp/fake/artifacts",
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
    """Đọc mọi dòng JSONL trong <tmp>/.agent/hooks/logs/ (repo giả)."""
    log_dir = tmp_path / ".agent" / "hooks" / "logs"
    lines: list[dict] = []
    if not log_dir.is_dir():
        return lines
    for log_file in sorted(log_dir.glob("gates-*.jsonl")):
        for line in log_file.read_text(encoding="utf-8").splitlines():
            if line.strip():
                lines.append(json.loads(line))
    return lines


def test_inject_when_anchor_doc_exists(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Anchor tồn tại -> stdout có injectSteps + log decision "inject"."""
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "domain-anchor.md").write_text("# Domain Anchor\n", encoding="utf-8")

    proc = run_gate(PAYLOAD, tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert "injectSteps" in out
    assert len(out["injectSteps"]) == 1
    message = out["injectSteps"][0]["ephemeralMessage"]
    assert "Domain Anchor" in message
    assert "docs/domain-anchor.md" in message

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["gate_id"] == "G1-05"
    assert logs[0]["rule_id"] == "Stage-5"
    assert logs[0]["event_dir"] == "pre_invocation"
    assert logs[0]["hook_event"] == "PreInvocation"
    assert logs[0]["decision"] == "inject"
    assert "reminder sent" in logs[0]["reason"]


def test_found_via_scan_when_not_in_configured_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Anchor ở vị trí không liệt kê trong rules -> vẫn tìm được bằng quét."""
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "domain_anchor.md").write_text("# Anchor\n", encoding="utf-8")

    proc = run_gate(PAYLOAD, tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert "injectSteps" in out
    assert "Domain Anchor" in out["injectSteps"][0]["ephemeralMessage"]
    assert "notes/domain_anchor.md" in out["injectSteps"][0]["ephemeralMessage"]

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "inject"


def test_scan_skips_node_modules_and_git(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Anchor trong node_modules/.git/.agent phải bị bỏ qua -> fail-open {}."""
    for skipped_dir in ("node_modules", ".git", ".agent"):
        (tmp_path / skipped_dir).mkdir(parents=True, exist_ok=True)
        (tmp_path / skipped_dir / "domain-anchor.md").write_text("# fake\n", encoding="utf-8")

    proc = run_gate(PAYLOAD, tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert "injectSteps" not in out
    assert out == {}

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "allow"
    assert "no anchor doc found" in logs[0]["reason"]


def test_allow_when_no_anchor_doc(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Không có anchor -> stdout {} + log decision "allow" (fail-open)."""
    proc = run_gate(PAYLOAD, tmp_path, monkeypatch)
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert out == {}
    assert "injectSteps" not in out

    logs = read_log_lines(tmp_path)
    assert len(logs) == 1
    assert logs[0]["decision"] == "allow"
    assert "no anchor doc found" in logs[0]["reason"]
    assert logs[0]["conversation_id"] == "test-conv-anchor"
    assert logs[0]["event"] == "hook_gate_decision"
