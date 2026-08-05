"""Contract + unit tests cho gate_placeholder_pre (G0-01)."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE_PATH = SCRIPTS_DIR / "pre_tool_use" / "gate_placeholder_pre.py"

RULES = {
    "placeholder": {
        "patterns": ["TODO", "FIXME", "XXX", "lorem ipsum", "mock data", "placeholder"],
        "exclude_paths": [],
        "scan_paths": ["src/"],
    },
}


def _load_gate():
    """Import gate module trực tiếp (main được guard bởi __name__)."""
    spec = importlib.util.spec_from_file_location("gate_placeholder_pre_ut", GATE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_rules(tmp_path: Path) -> None:
    """Ghi rules.yaml (JSON là YAML hợp lệ) để load_rules() đọc được."""
    cfg = tmp_path / ".claude" / "hooks" / "scripts" / "config"
    cfg.mkdir(parents=True, exist_ok=True)
    (cfg / "rules.yaml").write_text(json.dumps(RULES), encoding="utf-8")


def _payload(tool: str, args: dict) -> dict:
    return {
        "toolCall": {"name": tool, "args": args},
        "stepIdx": 0,
        "conversationId": "conv-placeholder-test",
    }


def _run_gate(payload: dict, tmp_path: Path) -> dict:
    """Chạy script qua subprocess, stdin=JSON, parse stdout JSON."""
    env = os.environ.copy()
    env["HOOK_REPO_ROOT"] = str(tmp_path)
    proc = subprocess.run(
        [sys.executable, str(GATE_PATH)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=SCRIPTS_DIR,
        env=env,
        timeout=30,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout.strip())


def test_deny_todo_in_code_content(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload(
            "write_to_file",
            {"TargetFile": "src/3_modules/a.ts", "CodeContent": "// TODO: fix\nconst x = 1;"},
        ),
        tmp_path,
    )
    assert result["decision"] == "deny"
    assert "line 1: TODO" in result["reason"]
    assert "BQD-2/ZPL-1" in result["reason"]


def test_deny_mock_data_in_replacement_chunks(tmp_path):
    _write_rules(tmp_path)
    chunks = [{"filePath": "src/3_modules/a.ts", "replacement": "const x = 'mock data';"}]
    result = _run_gate(
        _payload(
            "multi_replace_file_content",
            {"TargetFile": "src/3_modules/a.ts", "ReplacementChunks": chunks},
        ),
        tmp_path,
    )
    assert result["decision"] == "deny"
    assert "mock data" in result["reason"]


def test_allow_clean_content(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload(
            "write_to_file",
            {"TargetFile": "src/3_modules/a.ts", "CodeContent": "const value = 42;"},
        ),
        tmp_path,
    )
    assert result["decision"] == "allow"


def test_allow_empty_args(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("write_to_file", {}), tmp_path)
    assert result["decision"] == "allow"


def test_unit_check_returns_expected_decision():
    gate = _load_gate()
    decision, reason = gate.check(
        {"TargetFile": "src/a.ts", "CodeContent": "// TODO: fix"}, RULES
    )
    assert decision == "deny"
    assert "TODO" in reason
    decision, _ = gate.check({}, RULES)
    assert decision == "allow"
