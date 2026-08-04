"""Contract stdin/stdout cho mọi gate script (hook-standardized §7).

Đọc toàn bộ stdin -> HookPayload (fail-safe, không bao giờ raise) và
emit JSON hợp lệ ra stdout — stdout chỉ dành riêng cho quyết định gate.
"""

from dataclasses import dataclass, field
import json
import sys


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


def read_payload() -> HookPayload:
    """Đọc toàn bộ stdin, map sang HookPayload; mọi lỗi -> HookPayload(raw={})."""
    try:
        data = json.loads(sys.stdin.read())
        if not isinstance(data, dict):
            return HookPayload(raw={})
    except Exception:
        return HookPayload(raw={})

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


def emit(decision: str, reason: str = "", **extra) -> None:
    """In MỘT object JSON duy nhất ra stdout: {"decision", "reason", **extra}."""
    payload = {"decision": decision, "reason": reason}
    payload.update(extra)
    print(json.dumps(payload, ensure_ascii=False))


def emit_allow(reason: str = "") -> None:
    """Rút gọn emit("allow", reason) — gate không có vi phạm."""
    emit("allow", reason)


def emit_json(obj: dict) -> None:
    """In object JSON tùy ý ra stdout (PreInvocation: injectSteps; PostToolUse: {})."""
    print(json.dumps(obj, ensure_ascii=False))
