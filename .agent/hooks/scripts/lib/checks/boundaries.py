"""Scan ranh giới kiến trúc 5 tầng cho nội dung file sắp ghi (G1-06).

Kiểm tra: console.log trần, as any/@ts-ignore, chrome/document/window trong
3_modules/, postMessage ngoài bridge, import ngược tầng. Fail-safe mọi key.
"""

import re


def _compile(pattern: str) -> re.Pattern | None:
    """Compile regex, trả None nếu pattern rỗng hoặc không hợp lệ."""
    try:
        return re.compile(pattern) if pattern else None
    except Exception:
        return None


def scan_arch(content: str, target_file: str, rules: dict) -> list[dict]:
    """Trả [{"kind", "match", "line"}] cho mọi vi phạm ranh giới kiến trúc."""
    findings: list[dict] = []
    arch = rules.get("arch_boundary", {})
    lines = content.splitlines()

    # (a) console.log/debug/warn — trừ file logger_file
    logger_file = str(arch.get("logger_file", ""))
    if not target_file.endswith(logger_file):
        console_re = _compile(str(arch.get("console_log_regex", "")))
        if console_re is not None:
            for line_no, line in enumerate(lines, start=1):
                match = console_re.search(line)
                if match:
                    findings.append(
                        {"kind": "console_log", "match": match.group(0), "line": line_no}
                    )

    # (b) as any / @ts-ignore / @ts-expect-error
    for pattern in arch.get("ts_ignore", []):
        pattern_str = str(pattern)
        for line_no, line in enumerate(lines, start=1):
            if pattern_str in line:
                findings.append(
                    {"kind": "ts_ignore", "match": pattern_str, "line": line_no}
                )

    # (c) chrome.* / document. / window. trong 3_modules/
    if "3_modules/" in target_file:
        chrome_re = _compile(str(arch.get("chrome_regex", "")))
        if chrome_re is not None:
            for line_no, line in enumerate(lines, start=1):
                match = chrome_re.search(line)
                if match:
                    findings.append(
                        {"kind": "chrome_api", "match": match.group(0), "line": line_no}
                    )
        dom_re = _compile(str(arch.get("dom_regex", "")))
        if dom_re is not None:
            for line_no, line in enumerate(lines, start=1):
                match = dom_re.search(line)
                if match:
                    findings.append(
                        {"kind": "dom_api", "match": match.group(0), "line": line_no}
                    )

    # (d) postMessage ngoài bridge_file + ngoài danh sách exclude (runtime Port API)
    bridge_file = str(arch.get("bridge_file", ""))
    exclude_paths = [
        str(p) for p in arch.get("post_message_exclude_paths", [])
        if isinstance(p, (str, bytes)) or hasattr(p, "endswith")
    ]
    excluded = target_file.endswith(bridge_file) or any(
        target_file.endswith(p) for p in exclude_paths
    )
    if not excluded:
        post_re = _compile(str(arch.get("post_message_regex", "")))
        if post_re is not None:
            for line_no, line in enumerate(lines, start=1):
                match = post_re.search(line)
                if match:
                    findings.append(
                        {"kind": "post_message", "match": match.group(0), "line": line_no}
                    )

    # (e) import ngược tầng theo forbidden_imports (key là substring của target)
    forbidden = arch.get("forbidden_imports", {})
    if isinstance(forbidden, dict):
        for key, patterns in forbidden.items():
            if str(key) not in target_file:
                continue
            raw_list = patterns if isinstance(patterns, list) else []
            for pattern in raw_list:
                import_re = _compile(str(pattern))
                if import_re is None:
                    continue
                for line_no, line in enumerate(lines, start=1):
                    if "from " not in line and "import " not in line:
                        continue
                    if import_re.search(line):
                        findings.append(
                            {"kind": "forbidden_import", "match": str(pattern), "line": line_no}
                        )

    return findings
