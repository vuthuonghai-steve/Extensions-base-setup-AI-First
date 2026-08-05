"""Unit test cho lib/checks: placeholder, boundaries, doc_structure, transcript."""

import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.checks.boundaries import scan_arch  # noqa: E402
from lib.checks.doc_structure import (  # noqa: E402
    check_adr,
    check_domain_anchor,
    check_moscow,
    check_negative_space,
)
from lib.checks.placeholder import scan_repo, scan_text  # noqa: E402
from lib.checks.transcript import last_edit_needs_verify  # noqa: E402


# ---------------------------------------------------------------------------
# placeholder
# ---------------------------------------------------------------------------


def test_scan_text_finds_patterns_by_line():
    rules = {"placeholder": {"patterns": ["TODO", "FIXME", "lorem ipsum"]}}
    text = "# header\nTODO: fix me\n- FIXME here\nplain\nlorem ipsum dolor"
    assert scan_text(text, rules) == [
        {"line": 2, "match": "TODO"},
        {"line": 3, "match": "FIXME"},
        {"line": 5, "match": "lorem ipsum"},
    ]


def test_scan_text_is_case_insensitive():
    rules = {"placeholder": {"patterns": ["todo"]}}
    assert scan_text("TODO\n", rules) == [{"line": 1, "match": "todo"}]


def test_scan_text_supports_regex_patterns():
    rules = {"placeholder": {"patterns": [r"PLACEHOLDER-\d+"]}}
    assert scan_text("x\nplaceholder-42\n", rules) == [{"line": 2, "match": r"PLACEHOLDER-\d+"}]


def test_scan_text_empty_rules():
    assert scan_text("TODO\n", {}) == []
    assert scan_text("TODO\n", {"placeholder": {}}) == []
    assert scan_text("TODO\n", {"placeholder": {"patterns": "TODO"}}) == []


def test_scan_text_invalid_regex_ignored():
    rules = {"placeholder": {"patterns": ["[unclosed", "TODO"]}}
    assert scan_text("TODO\n", rules) == [{"line": 1, "match": "TODO"}]


def test_scan_repo_excludes_test_and_fixtures(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.ts").write_text("line\nTODO here\n", encoding="utf-8")
    (tmp_path / "src" / "b.ts").write_text("FIXME\n", encoding="utf-8")
    (tmp_path / "src" / "tests").mkdir()
    (tmp_path / "src" / "tests" / "c.test.ts").write_text("XXX\n", encoding="utf-8")
    (tmp_path / "src" / "fixtures").mkdir()
    (tmp_path / "src" / "fixtures" / "data.json").write_text("XXX\n", encoding="utf-8")

    rules = {
        "placeholder": {
            "patterns": ["TODO", "FIXME", "XXX"],
            "exclude_paths": ["**/test*/**", "**/fixtures/**", "**/*.test.*"],
            "scan_paths": ["src/"],
        }
    }
    findings = scan_repo(tmp_path, rules)
    assert findings == [
        {"file": "src/a.ts", "line": 2, "match": "TODO"},
        {"file": "src/b.ts", "line": 1, "match": "FIXME"},
    ]


def test_scan_repo_missing_scan_path(tmp_path):
    rules = {"placeholder": {"patterns": ["TODO"], "scan_paths": ["nope/"]}}
    assert scan_repo(tmp_path, rules) == []


def test_scan_repo_empty_rules(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.ts").write_text("TODO\n", encoding="utf-8")
    assert scan_repo(tmp_path, {}) == []


# ---------------------------------------------------------------------------
# boundaries
# ---------------------------------------------------------------------------


def _arch_rules(**overrides):
    rules = {
        "arch_boundary": {
            "console_log_regex": r"console\.(log|debug|warn)",
            "logger_file": "telemetry/logger.ts",
            "ts_ignore": ["as any", "@ts-ignore", "@ts-expect-error"],
            "chrome_regex": r"chrome\.[a-zA-Z]",
            "dom_regex": r"\b(document|window)\.",
            "post_message_regex": "postMessage",
            "bridge_file": "main-world-bridge.ts",
            "forbidden_imports": {
                "3_modules/": [r"from ['\"].*1_engine/", r"from ['\"].*2_platform_adapters/"],
                "1_engine/": [r"from ['\"].*3_modules/", r"from ['\"].*4_presentation/"],
            },
        }
    }
    rules["arch_boundary"].update(overrides)
    return rules


def test_scan_arch_console_log_blocked():
    content = "const x = 1;\nconsole.log(x);\n"
    findings = scan_arch(content, "src/foo.ts", _arch_rules())
    kinds = [(f["kind"], f["line"]) for f in findings]
    assert ("console_log", 2) in kinds


def test_scan_arch_console_log_allowed_in_logger_file():
    content = "const x = 1;\nconsole.log(x);\n"
    findings = scan_arch(content, "src/telemetry/logger.ts", _arch_rules())
    assert all(f["kind"] != "console_log" for f in findings)


def test_scan_arch_ts_ignore_flags():
    content = "// @ts-ignore\nconst y = x as any;\n"
    findings = scan_arch(content, "src/a.ts", _arch_rules())
    kinds = [(f["kind"], f["match"], f["line"]) for f in findings]
    assert ("ts_ignore", "@ts-ignore", 1) in kinds
    assert ("ts_ignore", "as any", 2) in kinds


def test_scan_arch_chrome_api_only_in_3_modules():
    content = "chrome.storage.local.get()\n"
    in_modules = scan_arch(content, "src/3_modules/a.ts", _arch_rules())
    assert any(f["kind"] == "chrome_api" for f in in_modules)

    outside = scan_arch(content, "src/1_engine/b.ts", _arch_rules())
    assert all(f["kind"] != "chrome_api" for f in outside)


def test_scan_arch_dom_api_only_in_3_modules():
    content = "window.addEventListener('x', fn);\ndocument.title = 't';\n"
    findings = scan_arch(content, "3_modules/c.ts", _arch_rules())
    kinds = [f["kind"] for f in findings]
    assert "dom_api" in kinds


def test_scan_arch_post_message_blocked_outside_bridge():
    content = "postMessage(data, '*');\n"
    findings = scan_arch(content, "src/content.ts", _arch_rules())
    assert any(f["kind"] == "post_message" for f in findings)


def test_scan_arch_post_message_allowed_in_bridge():
    content = "postMessage(data, '*');\n"
    findings = scan_arch(content, "src/main-world-bridge.ts", _arch_rules())
    assert all(f["kind"] != "post_message" for f in findings)

def test_scan_arch_post_message_allowed_on_exclude_path():
    content = "port.postMessage(data);\n"
    rules = _arch_rules(
        post_message_exclude_paths=["2_platform_adapters/ipc/port-channel.ts"]
    )
    findings = scan_arch(content, "src/2_platform_adapters/ipc/port-channel.ts", rules)
    assert all(f["kind"] != "post_message" for f in findings)

def test_scan_arch_post_message_blocked_outside_exclude_path():
    content = "port.postMessage(data);\n"
    rules = _arch_rules(
        post_message_exclude_paths=["2_platform_adapters/ipc/port-channel.ts"]
    )
    findings = scan_arch(content, "src/other/foo.ts", rules)
    assert any(f["kind"] == "post_message" for f in findings)


def test_scan_arch_forbidden_import():
    content = "import { x } from '1_engine/foo';\n"
    findings = scan_arch(content, "3_modules/a.ts", _arch_rules())
    assert any(f["kind"] == "forbidden_import" for f in findings)


def test_scan_arch_forbidden_import_not_applied_outside_key():
    content = "import { x } from '3_modules/foo';\n"
    findings = scan_arch(content, "src/plain.ts", _arch_rules())
    assert all(f["kind"] != "forbidden_import" for f in findings)


def test_scan_arch_missing_rules_key_is_fail_safe():
    content = "console.log('hi');\npostMessage('x');\nchrome.storage.get();\n"
    assert scan_arch(content, "src/3_modules/a.ts", {}) == []
    assert scan_arch(content, "src/3_modules/a.ts", {"arch_boundary": {}}) == []


# ---------------------------------------------------------------------------
# doc_structure
# ---------------------------------------------------------------------------

DOC_RULES = {
    "doc_structure": {
        "negative_space_min_items": 5,
        "negative_space_consequence_keywords": ["hậu quả", "consequence"],
        "moscow_must_have_max": 5,
        "glossary_min_terms": 10,
        "persona_min": 3,
        "failure_reasons_min": 5,
    }
}


def test_negative_space_too_few_items(tmp_path):
    doc = tmp_path / "negative-space.md"
    doc.write_text("- a\n- b\n- c\n", encoding="utf-8")
    assert check_negative_space(doc, DOC_RULES) == {"ok": False, "found": 3, "skipped": False}


def test_negative_space_enough_items_with_consequence(tmp_path):
    doc = tmp_path / "negative-space.md"
    doc.write_text(
        "- a\n- b\n- c\n- d\n- e\n- f: hậu quả nghiêm trọng\n", encoding="utf-8"
    )
    assert check_negative_space(doc, DOC_RULES) == {"ok": True, "found": 6, "skipped": False}


def test_negative_space_enough_items_but_no_consequence(tmp_path):
    doc = tmp_path / "negative-space.md"
    doc.write_text("- a\n- b\n- c\n- d\n- e\n- f\n", encoding="utf-8")
    result = check_negative_space(doc, DOC_RULES)
    assert result["ok"] is False
    assert result["found"] == 6


def test_negative_space_missing_file(tmp_path):
    result = check_negative_space(tmp_path / "nope.md", DOC_RULES)
    assert result == {"ok": True, "skipped": True}


def test_moscow_too_many_must_haves(tmp_path):
    doc = tmp_path / "scope.md"
    doc.write_text("\n".join("- Must-have: feature %d" % i for i in range(6)), encoding="utf-8")
    result = check_moscow(doc, DOC_RULES)
    assert result == {"ok": False, "found": 6}


def test_moscow_ok(tmp_path):
    doc = tmp_path / "scope.md"
    doc.write_text("- Must-have: a\n- Must have: b\n- Must-have: c\n", encoding="utf-8")
    assert check_moscow(doc, DOC_RULES) == {"ok": True, "found": 3}


def test_moscow_missing_file(tmp_path):
    assert check_moscow(tmp_path / "nope.md", DOC_RULES) == {"ok": True, "skipped": True}


def test_domain_anchor_partial(tmp_path):
    doc = tmp_path / "domain-anchor.md"
    doc.write_text(
        "# Domain Anchor\n"
        "\n"
        "## Glossary\n"
        "1. term alpha\n"
        "2. term beta\n"
        "\n"
        "## Stakeholders\n"
        "persona one\n"
        "\n"
        "## Issues\n"
        "fail fail fail fail\n"
        "\n"
        "## Cases\n"
        "edge case handled here\n",
        encoding="utf-8",
    )
    result = check_domain_anchor(doc, DOC_RULES)
    assert result["ok"] is False
    assert "glossary" in result["missing"]
    assert "persona" in result["missing"]
    assert "failure_reasons" in result["missing"]
    assert "edge_case" not in result["missing"]


def test_domain_anchor_missing_file(tmp_path):
    assert check_domain_anchor(tmp_path / "nope.md", DOC_RULES) == {"ok": True, "skipped": True}


def test_adr_empty_dir(tmp_path):
    adr_dir = tmp_path / "adr"
    adr_dir.mkdir()
    assert check_adr(adr_dir, DOC_RULES) == {
        "ok": False,
        "adr_count": 0,
        "missing_constraints": [],
    }


def test_adr_one_missing_constraints(tmp_path):
    adr_dir = tmp_path / "adr"
    adr_dir.mkdir()
    (adr_dir / "001-good.md").write_text("# ADR\n## Constraints\n- stay lean\n", encoding="utf-8")
    (adr_dir / "002-bad.md").write_text("# ADR\n## Options\n- x\n", encoding="utf-8")

    result = check_adr(adr_dir, DOC_RULES)
    assert result["ok"] is False
    assert result["adr_count"] == 2
    assert result["missing_constraints"] == ["002-bad.md"]


def test_adr_all_constraints_present(tmp_path):
    adr_dir = tmp_path / "adr"
    adr_dir.mkdir()
    (adr_dir / "001.md").write_text("# ADR\n## Constraints\n- ok\n", encoding="utf-8")
    result = check_adr(adr_dir, DOC_RULES)
    assert result == {"ok": True, "adr_count": 1, "missing_constraints": []}


def test_adr_missing_dir(tmp_path):
    assert check_adr(tmp_path / "nope", DOC_RULES) == {"ok": True, "skipped": True}


# ---------------------------------------------------------------------------
# transcript
# ---------------------------------------------------------------------------


def _write_transcript(tmp_path, lines):
    path = tmp_path / "transcript.jsonl"
    path.write_text("\n".join(json.dumps(line) for line in lines) + "\n", encoding="utf-8")
    return path


def test_edit_then_test_no_verify_needed(tmp_path):
    path = _write_transcript(
        tmp_path,
        [
            {"toolCall": {"name": "write_to_file", "args": {"TargetFile": "src/a.ts"}}},
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "npm test"}}},
        ],
    )
    result = last_edit_needs_verify(str(path), ["test", "lint", "typecheck"])
    assert result["needs_verify"] is False


def test_edit_without_test_needs_verify(tmp_path):
    path = _write_transcript(
        tmp_path,
        [{"toolCall": {"name": "write_to_file", "args": {"TargetFile": "src/a.ts"}}}],
    )
    result = last_edit_needs_verify(str(path), ["test", "lint", "typecheck"])
    assert result["needs_verify"] is True
    assert result["reason"]


def test_edit_then_non_verify_command_needs_verify(tmp_path):
    path = _write_transcript(
        tmp_path,
        [
            {"toolCall": {"name": "write_to_file", "args": {}}},
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "ls -la"}}},
        ],
    )
    assert last_edit_needs_verify(str(path), ["test", "lint"])["needs_verify"] is True


def test_verify_before_edit_does_not_count(tmp_path):
    path = _write_transcript(
        tmp_path,
        [
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "pytest"}}},
            {"toolCall": {"name": "write_to_file", "args": {}}},
        ],
    )
    assert last_edit_needs_verify(str(path), ["pytest"])["needs_verify"] is True


def test_tool_calls_array_shape(tmp_path):
    path = _write_transcript(
        tmp_path,
        [{"tool_calls": [{"name": "replace_file_content", "args": {}}]}],
    )
    assert last_edit_needs_verify(str(path), ["test"])["needs_verify"] is True


def test_flat_shape(tmp_path):
    path = _write_transcript(
        tmp_path,
        [{"name": "create_file", "args": {}}],
    )
    assert last_edit_needs_verify(str(path), ["test"])["needs_verify"] is True


def test_multi_replace_is_file_edit(tmp_path):
    path = _write_transcript(
        tmp_path,
        [{"toolCall": {"name": "multi_replace_file_content", "args": {}}}],
    )
    assert last_edit_needs_verify(str(path), ["test"])["needs_verify"] is True


def test_verify_command_after_edit_using_tool_calls(tmp_path):
    path = _write_transcript(
        tmp_path,
        [
            {"toolCall": {"name": "edit_file", "args": {}}},
            {"tool_calls": [{"name": "run_command", "args": {"CommandLine": "pnpm typecheck"}}]},
        ],
    )
    assert last_edit_needs_verify(str(path), ["typecheck"])["needs_verify"] is False


def test_missing_file_fail_open():
    assert last_edit_needs_verify("/nonexistent/x.jsonl", ["test"]) == {
        "needs_verify": False,
        "reason": "no transcript",
    }


def test_empty_transcript_fail_open(tmp_path):
    path = tmp_path / "transcript.jsonl"
    path.write_text("", encoding="utf-8")
    assert last_edit_needs_verify(str(path), ["test"]) == {
        "needs_verify": False,
        "reason": "no transcript",
    }


def test_bad_lines_tolerated(tmp_path):
    path = tmp_path / "transcript.jsonl"
    path.write_text("this is not json\n{'broken': true\n", encoding="utf-8")
    assert last_edit_needs_verify(str(path), ["test"]) == {
        "needs_verify": False,
        "reason": "no transcript",
    }
