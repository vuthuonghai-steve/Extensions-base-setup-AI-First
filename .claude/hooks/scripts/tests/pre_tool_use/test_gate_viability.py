"""Contract + unit tests cho gate_viability (G0-04, Stage-4)."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE_PATH = SCRIPTS_DIR / "pre_tool_use" / "gate_viability.py"

RULES = {
    "viability": {
        "gate_doc": "docs/decisions/viability-gate.md",
        "go_marker": "GO",
        "protected_code_paths": [
            "src/",
            "1_engine/",
            "2_platform_adapters/",
            "3_modules/",
            "4_presentation/",
        ],
    },
}


def _load_gate():
    """Import gate module trực tiếp (main được guard bởi __name__)."""
    spec = importlib.util.spec_from_file_location("gate_viability_ut", GATE_PATH)
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
        "toolCall": {"name": tool, "args": {"TargetFile": target, "CodeContent": "const x = 1;"}},
        "stepIdx": 2,
        "conversationId": "conv-viability-test",
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


def _write_go_doc(tmp_path: Path) -> None:
    """Tạo gate doc chứa marker GO dưới repo root."""
    doc = tmp_path / "docs" / "decisions" / "viability-gate.md"
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text("# Viability Gate\n\nGO\n", encoding="utf-8")


def test_deny_code_path_without_gate_doc(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("write_to_file", "src/3_modules/a.ts"), tmp_path)
    assert result["decision"] == "deny"
    assert "Thiếu GO" in result["reason"]


def test_allow_code_path_with_go_marker(tmp_path):
    _write_rules(tmp_path)
    _write_go_doc(tmp_path)
    result = _run_gate(_payload("write_to_file", "src/3_modules/a.ts"), tmp_path)
    assert result["decision"] == "allow"


def test_allow_non_code_path(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(_payload("write_to_file", "docs/notes.md"), tmp_path)
    assert result["decision"] == "allow"


def test_unit_check_returns_expected_decision(tmp_path):
    gate = _load_gate()
    decision, reason = gate.check({"TargetFile": "src/3_modules/a.ts"}, RULES, tmp_path)
    assert decision == "deny"
    assert "Thiếu GO" in reason
    _write_go_doc(tmp_path)
    decision, _ = gate.check({"TargetFile": "src/3_modules/a.ts"}, RULES, tmp_path)
    assert decision == "allow"
    decision, _ = gate.check({"TargetFile": "docs/notes.md"}, RULES, tmp_path)
    assert decision == "allow"
