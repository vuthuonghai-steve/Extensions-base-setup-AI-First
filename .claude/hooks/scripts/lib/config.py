"""Loader cấu hình chung: xác định repo root và nạp rules.yaml.

repo_root() dùng env HOOK_REPO_ROOT (tests) hoặc walk-up tìm thư mục chứa
.agent HOẶC .claude (bản đồng bộ sang Claude Code); load_rules() ưu tiên
rules.yaml thật của scripts/ (bản .claude), fall-back .claude rồi .agent.
"""

from functools import lru_cache
import os
from pathlib import Path

import yaml


def repo_root() -> Path:
    """Trả về thư mục repo gốc (env HOOK_REPO_ROOT, walk-up, hoặc cwd)."""
    env_root = os.environ.get("HOOK_REPO_ROOT")
    if env_root:
        return Path(env_root)

    current = Path(__file__).resolve().parent
    for candidate in (current, *current.parents):
        if (candidate / ".agent").exists() or (candidate / ".claude").exists():
            return candidate
    return Path.cwd()


@lru_cache(maxsize=1)
def load_rules() -> dict:
    """Nạp config/rules.yaml; lỗi/missing -> {} (fail-safe, cache kết quả)."""
    real_rules = Path(__file__).resolve().parents[1] / "config" / "rules.yaml"
    claude_rules = repo_root() / ".claude" / "hooks" / "scripts" / "config" / "rules.yaml"
    agent_rules = repo_root() / ".agent" / "hooks" / "scripts" / "config" / "rules.yaml"

    for path in (real_rules, claude_rules, agent_rules):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(data, dict):
            return data
    return {}
