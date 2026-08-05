"""Contract + unit tests cho gate_arch_boundary (G1-06)."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2]
GATE_PATH = SCRIPTS_DIR / "pre_tool_use" / "gate_arch_boundary.py"

RULES = {
    "arch_boundary": {
        "console_log_regex": r"console\.(log|debug|warn)",
        "ts_ignore": ["as any", "@ts-ignore", "@ts-expect-error"],
        "chrome_regex": r"chrome\.[a-z]",
        "dom_regex": r"(document|window)\.",
        "post_message_regex": r"postMessage",
        "bridge_file": "main-world-bridge.ts",
        "logger_file": "telemetry/logger.ts",
        "forbidden_imports": {
            "3_modules/": [r"from ['\"]1_engine/"],
            "2_platform_adapters/": [r"from ['\"]3_modules/"],
            "4_presentation/": [r"from ['\"]2_platform_adapters/", r"from ['\"]3_modules/"],
        },
    },
}


def _load_gate():
    """Import gate module trực tiếp (main được guard bởi __name__)."""
    spec = importlib.util.spec_from_file_location("gate_arch_boundary_ut", GATE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_rules(tmp_path: Path) -> None:
    """Ghi rules.yaml (JSON là YAML hợp lệ) để load_rules() đọc được."""
    cfg = tmp_path / ".claude" / "hooks" / "scripts" / "config"
    cfg.mkdir(parents=True, exist_ok=True)
    (cfg / "rules.yaml").write_text(json.dumps(RULES), encoding="utf-8")


def _payload(tool: str, target: str, content: str) -> dict:
    return {
        "toolCall": {"name": tool, "args": {"TargetFile": target, "CodeContent": content}},
        "stepIdx": 4,
        "conversationId": "conv-arch-test",
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


def test_deny_console_log_in_non_logger_file(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload("write_to_file", "src/3_modules/a.ts", "console.log('hello');"), tmp_path
    )
    assert result["decision"] == "deny"
    assert "console_log" in result["reason"]


def test_allow_console_log_in_logger_file(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload(
            "write_to_file",
            "src/4_presentation/telemetry/logger.ts",
            "console.log('structured');",
        ),
        tmp_path,
    )
    assert result["decision"] == "allow"


def test_deny_as_any(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload("write_to_file", "src/3_modules/a.ts", "const x = y as any;"), tmp_path
    )
    assert result["decision"] == "deny"
    assert "ts_ignore" in result["reason"]


def test_deny_chrome_api_in_modules(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload(
            "write_to_file",
            "src/3_modules/a.ts",
            "chrome.runtime.onMessage.addListener(cb);",
        ),
        tmp_path,
    )
    assert result["decision"] == "deny"
    assert "chrome_api" in result["reason"]


def test_deny_post_message_outside_bridge(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload("write_to_file", "src/3_modules/a.ts", "window.postMessage({t: 1}, '*');"),
        tmp_path,
    )
    assert result["decision"] == "deny"
    assert "post_message" in result["reason"]


def test_deny_forbidden_import_in_modules(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload(
            "write_to_file",
            "src/3_modules/a.ts",
            "import { engine } from '1_engine/core';",
        ),
        tmp_path,
    )
    assert result["decision"] == "deny"
    assert "forbidden_import" in result["reason"]


def test_allow_clean_content(tmp_path):
    _write_rules(tmp_path)
    result = _run_gate(
        _payload("write_to_file", "src/3_modules/a.ts", "const x = 1;"), tmp_path
    )
    assert result["decision"] == "allow"


def test_unit_check_returns_expected_decision():
    gate = _load_gate()
    decision, reason = gate.check(
        {"TargetFile": "src/3_modules/a.ts", "CodeContent": "console.log('x');"}, RULES
    )
    assert decision == "deny"
    assert "console_log" in reason
    decision, _ = gate.check({"TargetFile": "src/3_modules/a.ts", "CodeContent": "const x = 1;"}, RULES)
    assert decision == "allow"
