"""Unit test cho lib.hook_contract: read_payload + emit/emit_allow/emit_json."""

import io
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.hook_contract import (  # noqa: E402
    HookPayload,
    emit,
    emit_allow,
    emit_json,
    read_payload,
)


def _feed_stdin(monkeypatch, text: str) -> None:
    monkeypatch.setattr(sys, "stdin", io.StringIO(text))


def test_read_payload_pre_tool_use(monkeypatch):
    payload_json = json.dumps(
        {
            "toolCall": {
                "name": "write_to_file",
                "args": {"TargetFile": "src/a.ts", "CodeContent": "TODO"},
            },
            "stepIdx": 3,
            "conversationId": "ec33ebf9-0cba-4100-8142-c61503f6c587",
            "workspacePaths": ["/workspace/project"],
            "transcriptPath": "/tmp/transcript.jsonl",
            "artifactDirectoryPath": "/tmp/artifacts",
        }
    )
    _feed_stdin(monkeypatch, payload_json)

    payload = read_payload()
    assert payload.tool_name == "write_to_file"
    assert payload.args == {"TargetFile": "src/a.ts", "CodeContent": "TODO"}
    assert payload.step_idx == 3
    assert payload.conversation_id == "ec33ebf9-0cba-4100-8142-c61503f6c587"
    assert payload.workspace_paths == ["/workspace/project"]
    assert payload.transcript_path == "/tmp/transcript.jsonl"
    assert payload.artifact_dir == "/tmp/artifacts"
    assert payload.raw["toolCall"]["name"] == "write_to_file"


def test_read_payload_stop(monkeypatch):
    payload_json = json.dumps(
        {
            "executionNum": 2,
            "terminationReason": "model_stop",
            "error": "exit status 1",
            "fullyIdle": False,
        }
    )
    _feed_stdin(monkeypatch, payload_json)

    payload = read_payload()
    assert payload.termination_reason == "model_stop"
    assert payload.fully_idle is False
    assert payload.error == "exit status 1"


def test_read_payload_claude_stop_event(monkeypatch, capsys):
    payload_json = json.dumps(
        {
            "session_id": "session-123",
            "transcript_path": "/path/to/transcript.jsonl",
            "hook_event_name": "Stop",
            "stop_hook_active": True,
        }
    )
    _feed_stdin(monkeypatch, payload_json)

    payload = read_payload()
    assert payload.conversation_id == "session-123"
    assert payload.transcript_path == "/path/to/transcript.jsonl"

    # Verify emit behavior for Stop event: continue -> decision: block
    emit("continue", "Missing evidence")
    out = capsys.readouterr().out.strip()
    assert json.loads(out) == {"decision": "block", "reason": "Missing evidence"}

    # Verify emit_allow behavior for Stop event: allow -> {}
    _feed_stdin(monkeypatch, payload_json)
    read_payload()
    emit_allow("Scan clean")
    out = capsys.readouterr().out.strip()
    assert json.loads(out) == {}


def test_read_payload_pre_invocation(monkeypatch):
    payload_json = json.dumps({"invocationNum": 2, "initialNumSteps": 5})
    _feed_stdin(monkeypatch, payload_json)

    payload = read_payload()
    assert payload.invocation_num == 2


def test_read_payload_bad_json_returns_empty_raw(monkeypatch):
    _feed_stdin(monkeypatch, "not a json{")
    payload = read_payload()
    assert payload.raw == {}
    assert payload.tool_name == ""
    assert payload.args == {}
    assert payload.fully_idle is True


def test_read_payload_no_stdin(monkeypatch):
    _feed_stdin(monkeypatch, "")
    payload = read_payload()
    assert payload.raw == {}


def test_read_payload_non_dict_json(monkeypatch):
    _feed_stdin(monkeypatch, "[1, 2, 3]")
    payload = read_payload()
    assert payload.raw == {}


def test_emit_output_format(capsys):
    emit("deny", "BLOCKED", extra_field="value")
    out = capsys.readouterr().out.strip()
    parsed = json.loads(out)
    assert parsed == {"decision": "deny", "reason": "BLOCKED", "extra_field": "value"}


def test_emit_defaults(capsys):
    emit("allow")
    parsed = json.loads(capsys.readouterr().out.strip())
    assert parsed == {"decision": "allow", "reason": ""}


def test_emit_allow(capsys):
    emit_allow("no violation")
    parsed = json.loads(capsys.readouterr().out.strip())
    assert parsed == {"decision": "allow", "reason": "no violation"}


def test_emit_json(capsys):
    emit_json({"injectSteps": [{"ephemeralMessage": "remember the anchor"}]})
    parsed = json.loads(capsys.readouterr().out.strip())
    assert parsed == {"injectSteps": [{"ephemeralMessage": "remember the anchor"}]}


def test_hook_payload_defaults():
    payload = HookPayload(raw={})
    assert payload.step_idx is None
    assert payload.invocation_num is None
    assert payload.workspace_paths == []
    assert payload.fully_idle is True
    assert payload.error == ""
