"""Kiểm tra cấu trúc tài liệu cho gate_doc_structure (G1-01..G1-04).

Negative Space, MoSCoW, Domain Anchor và ADR. Mọi hàm fail-open khi file/
thư mục không tồn tại: {"ok": True, "skipped": True} — gate chỉ validate
tài liệu đã tồn tại.
"""

import re
from pathlib import Path


def _read(path: Path) -> str:
    """Đọc file; lỗi đọc -> chuỗi rỗng (fail-safe)."""
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def _as_int(value, default: int) -> int:
    """Chuyển config số an toàn; giá trị lỗi -> default."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _doc_section(rules: dict) -> dict:
    section = rules.get("doc_structure", {})
    return section if isinstance(section, dict) else {}


def check_negative_space(doc_path: Path, rules: dict) -> dict:
    """Đếm bullet "- "/"* "; ok khi đủ min_items VÀ có từ khóa hậu quả."""
    if not doc_path.is_file():
        return {"ok": True, "skipped": True}

    section = _doc_section(rules)
    min_items = _as_int(section.get("negative_space_min_items"), 5)
    raw_keywords = section.get("negative_space_consequence_keywords", ["hậu quả", "consequence"])
    keywords = [str(item).lower() for item in raw_keywords] if isinstance(raw_keywords, list) else []

    items = [line for line in _read(doc_path).splitlines() if line.startswith("- ") or line.startswith("* ")]
    has_consequence = any(any(keyword in item.lower() for keyword in keywords) for item in items)
    return {"ok": len(items) >= min_items and has_consequence, "found": len(items), "skipped": False}


def check_moscow(doc_path: Path, rules: dict) -> dict:
    """Đếm "must-have"/"must have"; ok khi không vượt moscow_must_have_max."""
    if not doc_path.is_file():
        return {"ok": True, "skipped": True}

    section = _doc_section(rules)
    max_must_have = _as_int(section.get("moscow_must_have_max"), 5)

    lower = _read(doc_path).lower()
    count = lower.count("must-have") + lower.count("must have")
    return {"ok": count <= max_must_have, "found": count}


def _glossary_term_count(text: str) -> int:
    """Đếm thuật ngữ (bullet/số thứ tự) trong section heading chứa 'glossary'."""
    lines = text.splitlines()
    start = -1
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("#") and "glossary" in stripped.lower():
            start = idx
            break
    if start < 0:
        return 0

    numbered = re.compile(r"^\s*\d+[.)]\s")
    count = 0
    for line in lines[start + 1:]:
        stripped = line.strip()
        if stripped.startswith("#"):
            break
        if stripped.startswith("- ") or stripped.startswith("* ") or numbered.match(line):
            count += 1
    return count


def check_domain_anchor(doc_path: Path, rules: dict) -> dict:
    """Kiểm tra glossary >= min thuật ngữ, persona, failure reasons, edge case."""
    if not doc_path.is_file():
        return {"ok": True, "skipped": True}

    section = _doc_section(rules)
    glossary_min = _as_int(section.get("glossary_min_terms"), 10)
    persona_min = _as_int(section.get("persona_min"), 3)
    failure_min = _as_int(section.get("failure_reasons_min"), 5)

    lower = _read(doc_path).lower()
    missing: list[str] = []
    if _glossary_term_count(_read(doc_path)) < glossary_min:
        missing.append("glossary")
    if lower.count("persona") < persona_min:
        missing.append("persona")
    if lower.count("fail") < failure_min:
        missing.append("failure_reasons")
    if "edge case" not in lower:
        missing.append("edge_case")
    return {"ok": not missing, "missing": missing}


def check_adr(adr_dir: Path, rules: dict) -> dict:
    """Đếm file *.md trong adr_dir; mỗi ADR phải chứa section 'Constraints'."""
    if not adr_dir.is_dir():
        return {"ok": True, "skipped": True}

    adr_files = sorted(p for p in adr_dir.rglob("*.md") if p.is_file())
    missing_constraints = [
        p.name for p in adr_files if "constraints" not in _read(p).lower()
    ]
    return {
        "ok": len(adr_files) > 0 and not missing_constraints,
        "adr_count": len(adr_files),
        "missing_constraints": missing_constraints,
    }
