# Scoping Checklist — Quality Gates

> **Purpose**: Self-check trước khi deliver scope document
> **Skill**: context-before-fix v1.0.0
> **Language**: Tiếng Việt

---

## Pre-Scoping Checks

```yaml
pre_scoping:
  - [ ] Issue description rõ ràng
  - [ ] Entry point đã được xác định
  - [ ] Feature area đã được xác định
  - [ ] User đã confirm scope (nếu cần)
```

---

## Discovery Phase Checks

```yaml
discovery_checks:
  entry_point_verified:
    - [ ] Entry point đã được read_file để confirm
    - [ ] Entry point line(s) đã được ghi nhận
  
  related_files_found:
    - [ ] Grep đã chạy cho entry point
    - [ ] Kết quả grep đã được review
    - [ ] ≥1 related files đã được xác định
  
  call_chain_traced:
    - [ ] Forward search (function gọi những gì) đã chạy
    - [ ] Backward search (ai gọi function) đã chạy
    - [ ] Import/require chain đã được trace
  
  grep_patterns_used:
    - [ ] `{function_name}(`
    - [ ] `import.*{function_name}`
    - [ ] `require.*{function_name}`
```

---

## Analysis Phase Checks

```yaml
analysis_checks:
  impact_mapping_complete:
    direct_impact:
      - [ ] Tất cả directly affected files đã được list
      - [ ] Specific line(s) đã được note
      - [ ] Nature of issue đã được mô tả
    
    indirect_impact:
      - [ ] Callers đã được xác định
      - [ ] Callees đã được xác định
      - [ ] Shared dependencies đã được note
    
    api_contracts:
      - [ ] Affected endpoints đã được identified
      - [ ] Contract changes đã được noted
  
  data_flow_traced:
    - [ ] Input data sources đã được xác định
    - [ ] Output destinations đã được xác định
    - [ ] Data transformations đã được noted
  
  evidence_collected:
    - [ ] Mỗi finding có file:line cụ thể
    - [ ] Evidence blocks đã được tạo
    - [ ] No assumptions without verification
```

---

## Confidence Assessment Checks

```yaml
confidence_checks:
  overall:
    - [ ] Confidence score đã được calculate
    - [ ] Score ≥ 60% → proceed
    - [ ] Score < 60% → STOP and ask user
  
  breakdown_review:
    - [ ] entry_point_identification: đã verify = read_file
    - [ ] impact_mapping: đã verify = grep + read_file
    - [ ] call_chain_trace: đã verify = multiple grep passes
    - [ ] evidence_verification: đã verify = read_file actual content
  
  uncertainty_flags:
    - [ ] Tất cả uncertainties đã được flag
    - [ ] User đã được notify về low confidence areas
```

---

## Output Quality Gates

```yaml
output_checks:
  document_structure:
    - [ ] Template structure đã được follow
    - [ ] Tất cả sections đã được filled
    - [ ] No placeholder values remain
  
  language_compliance:
    - [ ] Vietnamese language used throughout
    - [ ] No mixed language confusion
  
  path_compliance:
    - [ ] Path = `Docs/context-to-work/{feature-name}/scope.{YYYY-MM-DD}.md`
    - [ ] Directory exists hoặc đã được create
    - [ ] File extension = .md
  
  file_quality:
    - [ ] No code changes in document
    - [ ] No fix solutions provided
    - [ ] Only findings documented
```

---

## Final Declaration

```yaml
final_checks:
  before_deliver:
    - [ ] "NO CODE CHANGES" statement present
    - [ ] Path to document returned to user
    - [ ] Summary of findings delivered
    - [ ] Next steps mentioned
  
  delivery_format:
    - [ ] Document path clearly stated
    - [ ] Summary concise (≤5 bullet points)
    - [ ] Confidence level stated
```

---

## Gating Rules

```yaml
gate_rules:
  pass_all:
    - "Pre-Scoping" section must pass
    - "Discovery Phase" section must pass
    - "Analysis Phase" section must pass
    - "Confidence" section must pass
    - "Output" section must pass
  
  fail_any:
    - "Confidence below 60%" → STOP → ask user
    - "No entry point identified" → STOP → ask user
    - "No evidence collected" → STOP → gather more evidence
    - "Path compliance failed" → fix path before deliver
```

---

## Quick Reference

| Check | When | Gate |
|-------|-------|------|
| Entry point verified | After discovery | Must pass |
| Related files found | After discovery | Must pass |
| Impact mapped | After analysis | Must pass |
| Evidence collected | After analysis | Must pass |
| Confidence ≥ 60% | After assessment | Must pass |
| Path correct | Before deliver | Must pass |
| Vietnamese language | Before deliver | Must pass |

---

> **File**: `skills/rebuild/context-before-fix/loop/scoping-checklist.md`
> **Version**: 1.0.0
> **Date**: 2025-01-20
