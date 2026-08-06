"""Phân tích transcript.jsonl để quyết định Stop verify (G0-06).

Tìm lượt sửa file cuối cùng, rồi kiểm tra có lệnh verify (test/lint/
typecheck) chạy SAU nó không. Hỗ trợ 3 shape tool call; fail-open.
"""

import json
from pathlib import Path

_EDIT_TOKENS = ("write", "replace", "edit", "create")
_VERIFY_FIELD_NAMES = ("CommandLine", "commandLine", "cmd")


def _tool_calls(entry: dict) -> list[dict]:
    """Trích danh sách tool call từ một entry transcript theo 3 shape."""
    if isinstance(entry.get("toolCall"), dict):
        return [entry["toolCall"]]
    if isinstance(entry.get("tool_calls"), list):
        return [call for call in entry["tool_calls"] if isinstance(call, dict)]
    if isinstance(entry.get("name"), str):
        return [entry]
    return []


def _is_file_edit(name: str) -> bool:
    lower = name.lower()
    return any(token in lower for token in _EDIT_TOKENS)


def _is_verify_command(call: dict, verify_patterns: list[str]) -> bool:
    """Kiểm tra run_command có CommandLine khớp một verify pattern (substring)."""
    if call.get("name") != "run_command":
        return False
    args = call.get("args")
    if not isinstance(args, dict):
        return False
    command_line = ""
    for field in _VERIFY_FIELD_NAMES:
        value = args.get(field)
        if isinstance(value, str):
            command_line = value
            break
    lowered = command_line.lower()
    return any(str(pattern).lower() in lowered for pattern in verify_patterns)


def last_edit_needs_verify(transcript_path: str, verify_patterns: list[str]) -> dict:
    """Trả {"needs_verify", "reason"}; file thiếu/hỏng -> fail-open (False)."""
    if not transcript_path:
        return {"needs_verify": False, "reason": "no transcript"}

    path = Path(transcript_path)
    if not path.is_file():
        return {"needs_verify": False, "reason": "no transcript"}

    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return {"needs_verify": False, "reason": "no transcript"}

    entries: list[dict] = []
    for line in lines:
        try:
            parsed = json.loads(line)
        except Exception:
            continue
        if isinstance(parsed, dict):
            entries.append(parsed)

    last_edit_idx = -1
    for idx, entry in enumerate(entries):
        if any(_is_file_edit(call.get("name", "")) for call in _tool_calls(entry)):
            last_edit_idx = idx

    if last_edit_idx < 0:
        return {"needs_verify": False, "reason": "no transcript"}

    for entry in entries[last_edit_idx + 1:]:
        if any(_is_verify_command(call, verify_patterns) for call in _tool_calls(entry)):
            return {"needs_verify": False, "reason": "verify command found"}

    return {"needs_verify": True, "reason": "last file edit has no verify command"}
