# Output Schema — Scope Context Document

> **Purpose**: Định nghĩa cấu trúc chuẩn cho scope document đầu ra
> **Language**: Tiếng Việt (theo user requirement)
> **Standard**: Theo know.md — 4 lớp tri thức (L0/L1/L2/L3)

---

## 1. Mục đích

Scope Context Document là tài liệu **CHỈ ĐỌC** — cung cấp context đầy đủ cho việc fix sau. Tài liệu này **KHÔNG SỬA CODE**.

**Nguyên tắc**:

- Ghi nhận TẤT CẢ findings
- Không đưa ra giải pháp fix
- Dùng cho human review hoặc agent tiếp theo

---

## 2. Cấu trúc 4 Lớp (theo know.md)

### L0 — Anchor Rules (Luật nền)

```yaml
must:
  - document all findings
  - use Vietnamese language
  - write to Docs/context-to-work/{feature-name}/

must_not:
  - edit source code
  - provide fix solutions
  - make changes to codebase
```

### L1 — Working Policy (Quy ước làm việc)

```yaml
scope_definition:
  entry_point: 'File/component bắt đầu'
  problem_area: 'Khu vực bị ảnh hưởng'
  boundary: 'Giới hạn scope'

impact_mapping:
  direct_impact:
    files: []
    functions: []
  indirect_impact:
    files: []
    functions: []

output_contract:
  path: 'Docs/context-to-work/{feature-name}/scope.{YYYY-MM-DD}.md'
  format: Markdown + YAML
```

### L2 — Domain Context (Kiến thức nghiệp vụ)

Markdown với các sections:

- Problem Description (mô tả vấn đề)
- Entry Point Analysis (phân tích điểm vào)
- Call Chain ( chuỗi gọi)
- Data Flow (luồng dữ liệu)
- Affected Components (các thành phần bị ảnh hưởng)

### L3 — Evidence (Bằng chứng)

```xml
<evidence>
  <file>đường dẫn/file.ts</file>
  <line>123</line>
  <finding>Mô tả finding</finding>
</evidence>
```

---

## 3. Template Structure

```markdown
# Scope Document — {Tên Tính Năng}

**Date**: {YYYY-MM-DD}
**Status**: Initial | Updated | Ready

---

## §1: Problem Summary

{Mô tả ngắn gọn vấn đề}

## §2: Entry Point

{File/component bắt đầu}

## §3: Scope Definition

### 3.1 Problem Area

### 3.2 Boundary

## §4: Impact Analysis

### 4.1 Direct Impact

### 4.2 Indirect Impact

## §5: Call Chain

{Mermaid diagram hoặc markdown list}

## §6: Data Flow

### 6.1 Input

### 6.2 Output

### 6.3 Dependencies

## §7: Affected Components

### 7.1 Files

### 7.2 Functions/APIs

## §8: Evidence

<evidence> blocks

## §9: Confidence Assessment

- Overall Confidence: {X}%

## §10: Open Questions

- Items cần làm rõ

---

**Document Status**: Context Complete — No Code Changes Made
```

---

## 4. Confidence Assessment

```yaml
confidence_threshold: 60

confidence_levels:
  high_above_85:
    meaning: 'Tin chắc findings chính xác'
    action: 'Proceed to generate doc'

  medium_60_to_85:
    meaning: 'Khá chắc, có một số uncertainties'
    action: 'Document with uncertainty flags'

  low_below_60:
    meaning: 'Không chắc chắn'
    action: 'STOP — Ask user for clarification'
```

---

## 5. YAML Keys chuẩn (theo know.md)

```yaml
must:           # Hành vi bắt buộc
must_not:       # Hành vi cấm
scope:          # Phạm vi áp dụng
constraints:    # Ràng buộc
output_contract:# Định dạng đầu ra
confidence:     # Mức độ tin cậy
impact:         # Ảnh hưởng
evidence:       # Bằng chứng
```

---

## 6. XML Tags chuẩn

```xml
<scope>Phạm vi của vấn đề</scope>
<entry_point>Điểm vào ban đầu</entry_point>
<impact>Ảnh hưởng được xác định</impact>
<evidence>File/line/finding details</evidence>
<confidence>Mức độ tin cậy của analysis</confidence>
```

---

> **File**: `skills/rebuild/context-before-fix/knowledge/output-schema.md`
> **Version**: 1.0.0
> **Date**: 2025-01-20
