"""Unit test cho lib.logger: wide-event JSONL theo logging-best-practices."""

import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.logger import log_gate_decision  # noqa: E402


def _latest_log_file(tmp_path: Path) -> Path:
    logs_dir = tmp_path / ".claude" / "hooks" / "logs"
    files = sorted(logs_dir.glob("gates-*.jsonl"))
    assert files, "no gates-*.jsonl file written"
    return files[-1]


def test_log_writes_one_json_line_with_schema(tmp_path, monkeypatch):
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    monkeypatch.setenv("GIT_COMMIT", "abc1234")

    log_gate_decision(
        gate_id="G0-01",
        rule_id="BQD-2/ZPL-1",
        event_dir="pre_tool_use",
        hook_event="PreToolUse",
        decision="deny",
        reason="BLOCKED: TODO placeholder",
        target_file="src/a.ts",
        tool_name="write_to_file",
        conversation_id="ec33ebf9-0cba-4100-8142-c61503f6c587",
        step_idx=3,
        duration_ms=42,
    )

    log_path = _latest_log_file(tmp_path)
    lines = log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1

    record = json.loads(lines[0])
    assert record["event"] == "hook_gate_decision"
    assert record["gate_id"] == "G0-01"
    assert record["rule_id"] == "BQD-2/ZPL-1"
    assert record["event_dir"] == "pre_tool_use"
    assert record["hook_event"] == "PreToolUse"
    assert record["tool_name"] == "write_to_file"
    assert record["target_file"] == "src/a.ts"
    assert record["decision"] == "deny"
    assert record["reason"] == "BLOCKED: TODO placeholder"
    assert record["conversation_id"] == "ec33ebf9-0cba-4100-8142-c61503f6c587"
    assert record["step_idx"] == 3
    assert record["duration_ms"] == 42
    assert record["level"] == "error"
    assert record["commit_hash"] == "abc1234"
    assert record["timestamp"].startswith("20")
    assert "T" in record["timestamp"]


def test_log_append_second_line(tmp_path, monkeypatch):
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    log_gate_decision(gate_id="G0-01", rule_id="BQD-2", event_dir="pre_tool_use",
                      hook_event="PreToolUse", decision="deny")
    log_gate_decision(gate_id="G0-02", rule_id="BQD-2", event_dir="stop",
                      hook_event="Stop", decision="continue")

    log_path = _latest_log_file(tmp_path)
    lines = log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert json.loads(lines[1])["gate_id"] == "G0-02"


def test_log_level_info_for_allow(tmp_path, monkeypatch):
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    log_gate_decision(gate_id="G0-01", rule_id="BQD-2", event_dir="pre_tool_use",
                      hook_event="PreToolUse", decision="allow")
    record = json.loads(_latest_log_file(tmp_path).read_text(encoding="utf-8"))
    assert record["level"] == "info"


@pytest.mark.parametrize("decision", ["deny", "force_ask", "continue"])
def test_log_level_error_for_deny_like(tmp_path, monkeypatch, decision):
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    log_gate_decision(gate_id="G0-01", rule_id="BQD-2", event_dir="stop",
                      hook_event="Stop", decision=decision)
    record = json.loads(_latest_log_file(tmp_path).read_text(encoding="utf-8"))
    assert record["level"] == "error"


def test_log_never_raises_when_logs_dir_unwritable(tmp_path, monkeypatch, capsys):
    # .claude là file thường -> không thể tạo thư mục con -> log phải im lặng bỏ qua.
    broken_root = tmp_path / "broken"
    broken_root.mkdir()
    (broken_root / ".claude").write_text("i am a file, not a dir")

    monkeypatch.setenv("HOOK_REPO_ROOT", str(broken_root))
    log_gate_decision(gate_id="G0-01", rule_id="BQD-2", event_dir="pre_tool_use",
                      hook_event="PreToolUse", decision="deny")
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == ""


def test_log_never_prints_to_stdout(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("HOOK_REPO_ROOT", str(tmp_path))
    log_gate_decision(gate_id="G0-01", rule_id="BQD-2", event_dir="pre_tool_use",
                      hook_event="PreToolUse", decision="allow")
    captured = capsys.readouterr()
    assert captured.out == ""
