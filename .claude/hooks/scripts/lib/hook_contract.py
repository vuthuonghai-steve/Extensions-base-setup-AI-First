"""Contract stdin/stdout cho mọi gate script (hook-standardized §7).

Hỗ trợ song song 2 định dạng hook:

1. Antigravity (.agent/hooks): input `{"toolCall": {"name", "args"}, ...}`;
   output `{"decision": ..., "reason": ...}` hoặc `{"injectSteps": [...]}`.
2. Claude Code (.claude/hooks): input `{"tool_name", "tool_input",
   "hook_event_name", "session_id", "transcript_path", ...}`; output được
   dịch theo `hook_event_name` (PreToolUse: hookSpecificOutput.permissionDecision;
   Stop: `{"decision": "block"}`; SessionStart: additionalContext).

Đọc toàn bộ stdin -> HookPayload (fail-safe, không bao giờ raise) và
emit JSON hợp lệ ra stdout — stdout chỉ dành riêng cho quyết định gate.
"""

from dataclasses import dataclass, field
import json
import sys

# Map tool name Claude Code -> Antigravity để gate scripts chạy không đổi.
_TOOL_ALIAS = {
    "Write": "write_to_file",
    "Edit": "replace_file_content",
    "MultiEdit": "multi_replace_file_content",
    "Bash": "run_command",
}

# hook_event_name từ stdin Claude Code; "" = chế độ Antigravity (legacy).
_CURRENT_EVENT: str = ""


@dataclass
class HookPayload:
    """Payload chuẩn hóa từ JSON stdin của hook (field camelCase gốc giữ ở raw)."""

    raw: dict
    tool_name: str = ""
    args: dict = field(default_factory=dict)
    step_idx: int | None = None
    conversation_id: str = ""
    workspace_paths: list = field(default_factory=list)
    transcript_path: str = ""
    artifact_dir: str = ""
    termination_reason: str = ""
    fully_idle: bool = True
    invocation_num: int | None = None
    error: str = ""


def _translate_cc_args(tool_name: str, tool_input: dict) -> dict:
    """Map `tool_input` của Claude Code sang args chuẩn Antigravity."""
    if tool_name == "write_to_file":
        return {
            "TargetFile": tool_input.get("file_path", ""),
            "CodeContent": tool_input.get("content", ""),
        }
    if tool_name == "replace_file_content":
        return {
            "TargetFile": tool_input.get("file_path", ""),
            "ReplacementContent": tool_input.get("new_string", ""),
        }
    if tool_name == "multi_replace_file_content":
        return {
            "TargetFile": tool_input.get("file_path", ""),
            "ReplacementChunks": tool_input.get("edits", []),
        }
    if tool_name == "run_command":
        return {"CommandLine": tool_input.get("command", "")}
    return dict(tool_input or {})


def read_payload() -> HookPayload:
    """Đọc toàn bộ stdin, map sang HookPayload; mọi lỗi -> HookPayload(raw={})."""
    global _CURRENT_EVENT
    try:
        data = json.loads(sys.stdin.read())
        if not isinstance(data, dict):
            return HookPayload(raw={})
    except Exception:
        return HookPayload(raw={})

    # --- Claude Code format: hook_event_name / session_id / tool_name ---
    if "hook_event_name" in data or "session_id" in data or "tool_name" in data:
        _CURRENT_EVENT = str(data.get("hook_event_name", ""))
        cc_name = data.get("tool_name", "")
        tool_name = _TOOL_ALIAS.get(cc_name, cc_name) if isinstance(cc_name, str) else ""
        tool_input = data.get("tool_input")
        args = (
            _translate_cc_args(tool_name, tool_input)
            if isinstance(tool_input, dict)
            else {}
        )
        return HookPayload(
            raw=data,
            tool_name=tool_name,
            args=args,
            step_idx=None,
            conversation_id=str(data.get("session_id", "")),
            workspace_paths=[],
            transcript_path=str(data.get("transcript_path", "")),
            artifact_dir="",
            termination_reason="",
            fully_idle=True,
            invocation_num=None,
            error="",
        )

    # --- Antigravity format (legacy) ---
    _CURRENT_EVENT = ""
    tool_call = data.get("toolCall")
    tool_name = ""
    args: dict = {}
    if isinstance(tool_call, dict):
        tool_name = str(tool_call.get("name", ""))
        tool_args = tool_call.get("args")
        if isinstance(tool_args, dict):
            args = tool_args

    raw_ws = data.get("workspacePaths")
    workspace_paths = list(raw_ws) if isinstance(raw_ws, list) else []

    return HookPayload(
        raw=data,
        tool_name=tool_name,
        args=args,
        step_idx=data.get("stepIdx"),
        conversation_id=str(data.get("conversationId", "")),
        workspace_paths=workspace_paths,
        transcript_path=str(data.get("transcriptPath", "")),
        artifact_dir=str(data.get("artifactDirectoryPath", "")),
        termination_reason=str(data.get("terminationReason", "")),
        fully_idle=bool(data.get("fullyIdle", True)),
        invocation_num=data.get("invocationNum"),
        error=str(data.get("error", "")),
    )


def _claude_output(event: str, decision: str, reason: str) -> dict | None:
    """Dịch quyết định gate (Antigravity) sang JSON output Claude Code.

    Trả None khi không cần output (allow → im lặng, JSON {} hợp lệ).
    """
    if event == "PreToolUse":
        if decision == "deny":
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        if decision == "force_ask":
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                    "permissionDecisionReason": reason,
                }
            }
        return None
    if event == "Stop":
        if decision == "continue":
            return {"decision": "block", "reason": reason}
        return None
    # PostToolUse / SessionStart / UserPromptSubmit / ...: không decision control.
    return None


def emit(decision: str, reason: str = "", **extra) -> None:
    """In MỘT object JSON duy nhất ra stdout (dịch format theo môi trường)."""
    if _CURRENT_EVENT:
        out = _claude_output(_CURRENT_EVENT, decision, reason)
        print(json.dumps(out, ensure_ascii=False) if out is not None else "{}")
        return
    payload = {"decision": decision, "reason": reason}
    payload.update(extra)
    print(json.dumps(payload, ensure_ascii=False))


def emit_allow(reason: str = "") -> None:
    """Rút gọn emit("allow", reason) — gate không có vi phạm."""
    emit("allow", reason)


def emit_json(obj: dict) -> None:
    """In object JSON tùy ý ra stdout.

    Claude Code: injectSteps (PreInvocation Antigravity) được dịch sang
    hookSpecificOutput.additionalContext theo event đang chạy.
    """
    if _CURRENT_EVENT and isinstance(obj, dict) and obj.get("injectSteps"):
        steps = obj["injectSteps"]
        message = ""
        if isinstance(steps, list) and steps and isinstance(steps[0], dict):
            message = str(steps[0].get("ephemeralMessage", ""))
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": _CURRENT_EVENT,
                        "additionalContext": message,
                    }
                },
                ensure_ascii=False,
            )
        )
        return
    print(json.dumps(obj, ensure_ascii=False))
