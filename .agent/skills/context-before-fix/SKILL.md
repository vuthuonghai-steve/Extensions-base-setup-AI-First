---
name: context-before-fix
description: 'Skill phân tích scope vấn đề trước khi fix. Trigger khi user/agent có issue, bug, cần sửa, hoặc thêm mới tính năng. Output: scope context document tại Docs/context-to-work/{feature-name}/. KHÔNG sửa code — chỉ document findings.'
category: problem-analysis
version: '1.0.0'
author: 'Steve Void Team'
tags: [scoping, impact-analysis, context-documentation, vietnamese]
---

# Context Before Fix — Problem Scoping Skill

## Mission

Skill này **CHỈ DOCUMENT** — không sửa code. Trước khi fix bất kỳ vấn đề nào, agent phải:

1. Xác định scope thực sự của vấn đề
2. Map impact đầy đủ
3. Document findings vào file riêng
4. Trả về context cho việc fix sau

<instructions>
## Boot Sequence

1. Đọc `SKILL.md` (file này)
2. Đọc `knowledge/output-schema.md` — Output document structure
3. Đọc `knowledge/scoping-patterns.md` — Cách trace relationships
4. Tiến hành 4-Step Workflow

## 4-Step Workflow

### Step 1: INPUT ACCEPTANCE

- Nhận issue description (text/log/error)
- Xác định entry point (file/component)
- Hỏi user để làm rõ nếu cần

### Step 2: SCOPE DISCOVERY

- Tìm tất cả file liên quan (grep/search_files patterns)
- Map call chain (ai gọi ai, ai được gọi)
- Tìm shared dependencies

### Step 3: IMPACT ANALYSIS

- Tính năng bị ảnh hưởng trực tiếp
- Tính năng bị ảnh hưởng gián tiếp
- Data flow bị ảnh hưởng
- API contracts bị break

### Step 4: DOCUMENT GENERATION

- Ghi nhận TẤT CẢ findings
- KHÔNG đưa ra giải pháp fix
- Lưu vào `Docs/context-to-work/{feature-name}/scope.{YYYY-MM-DD}.md`
- Trả về đường dẫn document + summary
</instructions>

---

## Core Constraints

```yaml
must:
  - document all findings
  - use Vietnamese language in output
  - write output to Docs/context-to-work/{feature-name}/
  - ask user when uncertain (confidence < 60%)
  - trace all findings to specific files/lines

must_not:
  - edit source code
  - create branches
  - run tests
  - deploy anything
  - delete files
  - provide fix solutions

priority_order:
  - understanding_scope
  - mapping_impact
  - documenting_findings
  - NO_code_changes
```

---

## Confidence Handling

```yaml
confidence_threshold: 60

confidence_levels:
  above_85:
    meaning: 'Tin chắc findings chính xác'
    action: 'Proceed to generate doc'

  60_to_85:
    meaning: 'Khá chắc, có một số uncertainties'
    action: 'Document with uncertainty flags'

  below_60:
    meaning: 'Không chắc chắn'
    action: 'STOP — Ask user for clarification using clarify tool'
```

---

## Tools

```yaml
primary_tools:
  - search_files # grep patterns để tìm related files
  - read_file # inspect actual content
  - write_file # generate output document
  - clarify # hỏi user khi uncertain

reasoning:
  - LLM analyze relationships
  - trace logic chains
  - identify patterns
```

---

## Output Contract

```yaml
output_contract:
  path_pattern: 'Docs/context-to-work/{feature-name}/scope.{YYYY-MM-DD}.md'

  sections:
    - Problem Summary
    - Entry Point
    - Scope Definition
    - Impact Analysis (Direct + Indirect)
    - Call Chain
    - Data Flow
    - Affected Components
    - Evidence
    - Confidence Assessment
    - Open Questions

  format: Markdown + YAML (theo know.md standards)
  language: Vietnamese
```

---

## Progressive Disclosure

```yaml
Tier_1_Mandatory:
  description: 'Load always at boot'
  files:
    - SKILL.md
    - knowledge/output-schema.md

Tier_2_Conditional:
  description: 'Load when context requires'
  files:
    - knowledge/scoping-patterns.md
    - templates/scope-doc.template
    - loop/scoping-checklist.md
```

---

## Guardrails

```yaml
guardrails:
  G1_no_code_changes:
    must_not: [edit_source_code, create_branches, run_tests, deploy]

  G2_ask_when_uncertain:
    condition: 'confidence < 60%'
    action: 'STOP → clarify with user'

  G3_trace_findings:
    must: [verify_with_read_file, link_to_specific_files]

  G4_vietnamese_output:
    must: [use_Vietnamese_in_document, use_Vietnamese_in_summary]
```

---

## Stop Conditions

```yaml
stop_conditions:
  - Document written to disk at correct path
  - User receives path to scope document
  - User receives summary of findings
  - Statement: 'NO CODE CHANGES — Context ready for fix phase'
```

---

## Large Codebase Fallback

```yaml
large_codebase_strategy:
  when: 'grep/search timeout hoặc >50 results'
  action:
    - Ask user to narrow scope
    - Limit search to specific module/feature
    - Use entry point approach (don't full scan)
  max_bounded_search:
    max_files: 20
    max_depth: 3
```

---

## Quality Checklist (self-check trước khi deliver)

```yaml
pre_delivery_check:
  - [ ] Entry point identified và verified
  - [ ] Tất cả related files đã được search
  - [ ] Impact map đầy đủ (direct + indirect)
  - [ ] Evidence ghi nhận cụ thể (file:line)
  - [ ] Confidence assessment đã làm
  - [ ] Document viết bằng tiếng Việt
  - [ ] Document lưu đúng path pattern
  - [ ] NO code changes made
```

---

## Example

```
Input: "Checkout bị lỗi khi apply coupon"

Workflow:
1. Entry: src/services/coupon.service.ts
2. Discovery: grep validateCoupon → tìm 5 files liên quan
3. Impact: OrderService, CheckoutForm, PaymentGateway
4. Output: Docs/context-to-work/checkout-coupon/scope.2025-01-20.md

Document summary:
- Problem: Coupon validation logic error
- Scope: 5 files affected
- Impact: Direct (coupon service) + Indirect (checkout, payment)
- Confidence: 75%
- Next: Ready for fix phase
```

---

> **File**: `skills/rebuild/context-before-fix/SKILL.md`
> **Version**: 1.0.0
> **Date**: 2025-01-20
