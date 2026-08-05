"""Contract + unit tests cho gate_contract_lock (G0-03, fail-closed)."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE_PATH = SCRIPTS_DIR / "pre_tool_use" / "gate_contract_lock.py"

RULES = {
    "contract_lock": {"protected_dirs": ["0_contracts/"], "decision": "force_ask"},
}


def _load_gate():
    """Import gate module trực tiếp (main được guard bởi __name__)."""
    spec = importlib.util.spec_from_file_location("gate_contract_lock_ut", GATE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_rules(tmp_path: Path) -> None:
    """Ghi rules.yaml (JSON là YAML hợp lệ) để load_rules() đọc được."""
    cfg = tmp_path / ".claude" / "hooks" / "scripts" / "config"
    cfg.mkdir(parents=True, exist_ok=True)
    (cfg / "rules.yaml").write_text(json.dumps(RULES), encoding="utf-8")


def _payload(tool: str, target: str) -> dict:
    return {
        "toolCall": {"name": tool, "args": {"TargetFile": target}},
        "stepIdx": 1,
        "conversationId": "conv-contract-test",
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


def test_force_ask_for_contract_dir(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("write_to_file", "src/0_contracts/ipc-payloads.ts"), tmp_path)
    assert result["decision"] == "force_ask"
    assert "DES-2" in result["reason"]


def test_allow_for_normal_module(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("write_to_file", "src/3_modules/a.ts"), tmp_path)
    assert result["decision"] == "allow"


def test_unit_check_returns_expected_decision():
    gate = _load_gate()
    decision, reason = gate.check({"TargetFile": "src/0_contracts/ipc-payloads.ts"}, RULES)
    assert decision == "force_ask"
    assert "0_contracts/" in reason
    decision, _ = gate.check({"TargetFile": "src/3_modules/a.ts"}, RULES)
    assert decision == "allow"
