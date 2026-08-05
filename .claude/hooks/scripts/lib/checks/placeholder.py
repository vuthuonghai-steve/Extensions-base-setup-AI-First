"""Scan placeholder (TODO/mock data/lorem ipsum) trong text và repo.

Dùng chung cho G0-01 (PreToolUse scan CodeContent) và G0-02
(Stop full-repo scan). Fail-safe: rules thiếu/sai -> kết quả rỗng.
"""

import fnmatch
import re
from pathlib import Path


def _patterns(rules: dict) -> list[tuple[str, re.Pattern]]:
    """Trả về [(pattern_str, compiled_regex)]; bỏ qua pattern không compile được."""
    section = rules.get("placeholder", {})
    raw_patterns = section.get("patterns", [])
    if not isinstance(raw_patterns, list):
        return []
    compiled: list[tuple[str, re.Pattern]] = []
    for pattern in raw_patterns:
        try:
            compiled.append((str(pattern), re.compile(str(pattern), re.IGNORECASE)))
        except Exception:
            continue
    return compiled


def scan_text(text: str, rules: dict) -> list[dict]:
    """Tìm pattern (không phân biệt hoa thường) theo từng dòng 1-based."""
    findings: list[dict] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        for pattern, regex in _patterns(rules):
            try:
                if regex.search(line):
                    findings.append({"line": line_no, "match": pattern})
            except Exception:
                continue
    return findings


def _excludes(rules: dict) -> list[str]:
    section = rules.get("placeholder", {})
    raw = section.get("exclude_paths", [])
    return [str(item) for item in raw] if isinstance(raw, list) else []


def _scan_paths(rules: dict) -> list[str]:
    section = rules.get("placeholder", {})
    raw = section.get("scan_paths", [])
    return [str(item) for item in raw] if isinstance(raw, list) else []


def scan_repo(repo: Path, rules: dict) -> list[dict]:
    """Quét các thư mục scan_paths dưới repo, bỏ qua file theo exclude_paths."""
    findings: list[dict] = []
    excludes = _excludes(rules)

    for rel in _scan_paths(rules):
        root = repo / rel
        if not root.is_dir():
            continue
        for file_path in root.rglob("*"):
            if not file_path.is_file():
                continue
            try:
                rel_path = file_path.relative_to(repo).as_posix()
            except ValueError:
                continue
            if any(fnmatch.fnmatch(rel_path, pattern) for pattern in excludes):
                continue
            try:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for item in scan_text(text, rules):
                findings.append(
                    {"file": rel_path, "line": item["line"], "match": item["match"]}
                )
    return findings
