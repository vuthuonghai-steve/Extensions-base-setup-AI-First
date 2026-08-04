"""Loader cấu hình chung: xác định repo root và nạp rules.yaml.

repo_root() dùng env HOOK_REPO_ROOT (tests) hoặc walk-up tìm thư mục chứa
.agent; load_rules() ưu tiên rules.yaml thật của scripts/, fall-back fail-safe.
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
        if (candidate / ".agent").exists():
            return candidate
    return Path.cwd()


@lru_cache(maxsize=1)
def load_rules() -> dict:
    """Nạp config/rules.yaml; lỗi/missing -> {} (fail-safe, cache kết quả)."""
    real_rules = Path(__file__).resolve().parents[1] / "config" / "rules.yaml"
    repo_rules = repo_root() / ".agent" / "hooks" / "scripts" / "config" / "rules.yaml"

    for path in (real_rules, repo_rules):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if isinstance(data, dict):
            return data
    return {}
