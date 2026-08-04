"""Contract + unit tests cho gate_test_bypass (G0-05, Stage-5)."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE_PATH = SCRIPTS_DIR / "pre_tool_use" / "gate_test_bypass.py"

RULES = {
    "test_bypass": {
        "patterns": [
            "--no-verify",
            "--skip-",
            "\\[skip ci\\]",
            "describe\\.only",
            "it\\.only",
            "test\\.skip",
        ],
    },
}


def _load_gate():
    """Import gate module trực tiếp (main được guard bởi __name__)."""
    spec = importlib.util.spec_from_file_location("gate_test_bypass_ut", GATE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_rules(tmp_path: Path) -> None:
    """Ghi rules.yaml (JSON là YAML hợp lệ) để load_rules() đọc được."""
    cfg = tmp_path / ".agent" / "hooks" / "scripts" / "config"
    cfg.mkdir(parents=True, exist_ok=True)
    (cfg / "rules.yaml").write_text(json.dumps(RULES), encoding="utf-8")


def _payload(command: str) -> dict:
    return {
        "toolCall": {"name": "run_command", "args": {"CommandLine": command}},
        "stepIdx": 3,
        "conversationId": "conv-bypass-test",
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


def test_deny_no_verify(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("git commit --no-verify -m x"), tmp_path)
    assert result["decision"] == "deny"
    assert "--no-verify" in result["reason"]


def test_deny_skip(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("npm test -- --skip-"), tmp_path)
    assert result["decision"] == "deny"
    assert "--skip-" in result["reason"]


def test_allow_normal_test_command(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("npm test"), tmp_path)
    assert result["decision"] == "allow"


def test_unit_check_returns_expected_decision():
    gate = _load_gate()
    decision, reason = gate.check({"CommandLine": "git commit --no-verify -m x"}, RULES)
    assert decision == "deny"
    assert "--no-verify" in reason
    decision, _ = gate.check({"CommandLine": "npm test"}, RULES)
    assert decision == "allow"
