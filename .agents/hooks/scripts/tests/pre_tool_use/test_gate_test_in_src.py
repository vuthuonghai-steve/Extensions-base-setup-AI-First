"""Contract + unit tests cho gate_test_in_src (G1-09) — cấm file test trong src/."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE_PATH = SCRIPTS_DIR / "pre_tool_use" / "gate_test_in_src.py"

RULES = {
    "test_placement": {
        "scan_paths": ["src/"],
        "tests_root": "tests/unit/",
    },
}


def _load_gate():
    """Import gate module trực tiếp (main được guard bởi __name__)."""
    spec = importlib.util.spec_from_file_location("gate_test_in_src_ut", GATE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_rules(tmp_path: Path) -> None:
    """Ghi rules.yaml (JSON là YAML hợp lệ) để load_rules() đọc được."""
    cfg = tmp_path / ".claude" / "hooks" / "scripts" / "config"
    cfg.mkdir(parents=True, exist_ok=True)
    (cfg / "rules.yaml").write_text(json.dumps(RULES), encoding="utf-8")


def _payload(target: str) -> dict:
    return {
        "toolCall": {"name": "write_to_file", "args": {"TargetFile": target, "CodeContent": ""}},
        "stepIdx": 4,
        "conversationId": "conv-test-src",
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


# -- unit: check() -----------------------------------------------------------

def test_unit_denies_test_file_in_src():
    gate = _load_gate()
    decision, reason = gate.check({"TargetFile": "src/3_modules/x.test.ts"}, RULES)
    assert decision == "deny"
    assert "tests/unit/" in reason


def test_unit_denies_spec_file_in_src():
    gate = _load_gate()
    decision, _ = gate.check({"TargetFile": "src/3_modules/x.spec.ts"}, RULES)
    assert decision == "deny"


def test_unit_allows_normal_source_file():
    gate = _load_gate()
    decision, _ = gate.check({"TargetFile": "src/3_modules/x.ts"}, RULES)
    assert decision == "allow"


def test_unit_allows_test_outside_src():
    gate = _load_gate()
    decision, _ = gate.check({"TargetFile": "tests/unit/3_modules/x.spec.ts"}, RULES)
    assert decision == "allow"


def test_unit_allows_test_like_name_outside_src_dir():
    gate = _load_gate()
    decision, _ = gate.check({"TargetFile": "scripts/src-helper.test.ts"}, RULES)
    assert decision == "allow"


def test_unit_fail_safe_on_empty_target():
    gate = _load_gate()
    decision, _ = gate.check({"TargetFile": ""}, RULES)
    assert decision == "allow"


def test_unit_fail_safe_on_missing_rules():
    gate = _load_gate()
    decision, _ = gate.check({"TargetFile": "src/a.test.ts"}, {})
    assert decision == "allow"


# -- contract: subprocess stdin/stdout ---------------------------------------

def test_hook_deny_emits_decision(tmp_path):
    _write_rules(tmp_path)
    out = _run_gate(_payload("src/3_modules/foo.test.ts"), tmp_path)
    assert out["decision"] == "deny"
    assert "tests/unit/" in out["reason"]


def test_hook_allow_emits_decision(tmp_path):
    _write_rules(tmp_path)
    out = _run_gate(_payload("tests/unit/3_modules/foo.spec.ts"), tmp_path)
    assert out["decision"] == "allow"


def test_hook_deny_real_rules_file(tmp_path):
    # Subprocess luôn đọc rules.yaml thật của scripts/config (load_rules ưu
    # tiên real_rules) — với config thật, test trong src/ bị deny.
    _write_rules(tmp_path)
    out = _run_gate(_payload("src/3_modules/foo.test.ts"), tmp_path)
    assert out["decision"] == "deny"
    assert "tests/unit/" in out["reason"]
