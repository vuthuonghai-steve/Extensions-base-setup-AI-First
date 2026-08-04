# 🧠 7 LLM Principles → Architecture Design Mapping (skill-explorer v1.0)

> **Nguồn:** `synthesis-llm-principles.md` (7 principles) + `domain-handbook.md §3.A` (gap analysis)
> **Mục đích:** Cung cấp chi tiết implement cho architect — cơ chế, data contracts, quality gates, workflow phases, priority
> **Ngày:** 2026-07-11

---

## Chi Tiết Từng Principle

### (1) DOMAIN ANCHORING — Neo ngữ nghĩa

**Cơ chế hoạt động:**

- LLM hoạt động trong không gian vector ngữ nghĩa → cần neo đậu trước khi suy luận
- Neo sai → output lệch semantic dù technical đúng
- 4 loại neo: Domain Glossary (10+ terms), Thought Blocks (>200 từ), Stakeholder Empathy, Defensive Reasoning
- Thought blocks được "bơm" làm mỏ neo vector ngôn ngữ

**Biểu hiện trong skill-explorer v1.0:**

- `SKILL.md` boot: phải inject glossary 10+ terms ngay từ đầu
- `thought-cache.yaml`: lưu thought blocks làm mỏ neo
- `hydrated-context.yaml`: glossary là field bắt buộc

**Yêu cầu implement cụ thể:**

| Component               | Detail                                             | File affected                           |
| ----------------------- | -------------------------------------------------- | --------------------------------------- |
| Glossary ≥10 terms      | SKILL boot định nghĩa semantic anchor terms        | `SKILL.md` lines 12-27                  |
| Thought Blocks ≥200 từ  | Mỗi block trong thought-cache.yaml                 | `templates/thought-cache.yaml.template` |
| META-2.1 anti-gaming    | 4 signals (S1-S4) trong mỗi thought block          | `loop/exploration-checklist.md`         |
| Thought block injection | Hydrator inject thought blocks trước Builder phase | `policy/workflow.md` Phase 2.5          |

**Data contracts impact:**

```yaml
# thought-cache.yaml — mandatory fields
thought_blocks:
  - id: 'tb-1'
    content: 'string (>=200 words)' # semantic depth guarantee
    signals:
      s1_negation: true # must_not / "không"
      s2_reverse_question: true # "?" marker
      s3_multi_stakeholder: true # user/dev/người
      s4_constraint_anchoring: true # constraint/ràng buộc
```

**Architect note:** Đây là principle nền tảng. Nếu thiếu, mọi technical improvement sau đều vô nghĩa vì LLM suy luận sai không gian.

---

### (2) SEMANTIC OVER CEREMONY — Đậm đặc ngữ nghĩa > format

**Cơ chế hoạt động:**

- LLM cần nội dung đậm đặc ngữ nghĩa hơn format cầu kỳ
- Data contracts xác định (input_schema/output_schema) > mô tả dài dòng
- Binary gates cơ học > thang điểm NLP chủ quan
- `hydrated-context.yaml` ~30-50 dòng: chỉ glossary, NFR, edge cases, contracts, zone map, must_not — loại bỏ prose

**Biểu hiện trong skill-explorer v1.0:**

- Thay `exploration-checklist.md` (soft Q&A) bằng META-2.1 mechanical check
- Mỗi task trong todo.md có back-link tới design.md §3 Zone Mapping
- Token budget control: hydrated-context ≤50 dòng, todo.md <1200 tokens

**Yêu cầu implement:**

| Component               | Detail                                    | File affected                              |
| ----------------------- | ----------------------------------------- | ------------------------------------------ |
| Data contracts          | input_schema/output_schema mọi task       | `policy/output-spec.md`                    |
| Binary gates            | META-2.1 thay soft questions              | `loop/exploration-checklist.md`            |
| Hydrated context budget | Giới hạn 30-50 dòng YAML                  | `templates/hydrated-context.yaml.template` |
| Mechanical verification | Regex/script check, không model inference | `scripts/schema_validator.py`              |

**Quality gates impact:**

```python
# BEFORE (v0.0.2): soft, gameable
"Is exploration complete?"  → LLM tự đánh giá

# AFTER (v1.0): binary, mechanical
def meta_2_1_pass(block: str) -> bool:
    s1 = "must_not" in block.lower() or "không" in block
    s2 = "?" in block
    s3 = any(role in block for role in ("user", "dev", "agent", "người"))
    s4 = "constraint" in block.lower() or "ràng buộc" in block
    return s1 and s2 and s3 and s4  # deterministic, scriptable
```

---

### (3) CONTEXT PRE-PROCESSING — Hydrator tách khỏi Planner

**Cơ chế hoạt động:**

- Thay vì Planner vừa đọc domain-handbook vừa plan (80% token cho đọc):
  **Hydrator** đọc domain-handbook + exploration → nén thành `hydrated-context.yaml` (~30-50 dòng)
  → Planner chỉ nhận gói cô đọng → 100% token cho planning
- Giống "context compression" nhưng có chọn lọc, giữ nguyên semantic

**Biểu hiện trong skill-explorer v1.0:**

**Thay đổi pipeline:**

```
v0.0.2: Phase 1 → Phase 2 → Phase 3 → Phase 4
         (Init)   (Mine)   (Validate) (Output)

v1.0:   Phase 1 → Phase 2 → Phase 2.5 (NEW) → Phase 3 → Phase 4
         (Init)   (Mine)   (Hydration)        (Gate)   (Output)
                            ↑ Context Pre-processing
```

**Yêu cầu implement:**

| Component                      | Detail                                                                | File affected                              |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------ |
| Phase 2.5                      | Context Hydration phase mới                                           | `policy/workflow.md`                       |
| Hydrator subagent              | Agent chuyên pre-process context                                      | New micro-skill or expanded role           |
| Template hydrated-context.yaml | Schema: glossary, nfr, edge_cases, data_contracts, zone_map, must_not | `templates/hydrated-context.yaml.template` |
| Context Bus integration        | Hydrator commit vào Context Bus trước Stage 1.5                       | `protocols-and-state-spec.md`              |

**Data contracts impact:**

```yaml
# hydrated-context.yaml — mandatory for planner+builder
skill_name: '{target_skill}'
glossary:
  - term: 'string'
    definition: 'string'
nfr:
  - id: 'string'
    requirement: 'string'
edge_cases:
  - scenario: 'string'
    expected: 'string'
data_contracts:
  input: 'schema reference'
  output: 'schema reference'
must_not:
  - 'string'
zone_map:
  core: ['SKILL.md']
  knowledge: ['knowledge/*.md']
```

**Consumer routing:**

| Artifact                | Planner      | Builder      |
| ----------------------- | ------------ | ------------ |
| `hydrated-context.yaml` | ✅ Mandatory | ✅ Mandatory |
| `thought-cache.yaml`    | ⚡ Optional  | ✅ Mandatory |

---

### (4) DUAL KNOWLEDGE STREAM — Technical + Cognitive 2 luồng riêng

**Cơ chế hoạt động:**

- LLM cần 2 luồng thông tin song song với lifecycle khác nhau
- **Technical scaffolding** (`hydrated-context.yaml`): biết "code gì" — ~30-50 dòng
- **Cognitive depth** (`thought-cache.yaml`): biết "vì sao, cho ai" — ~100-200 dòng
- Separation of concerns: inline vs file reference, optional vs mandatory

**Biểu hiện trong skill-explorer v1.0—Thay đổi cốt lõi:**

```
From:  1 artifact (exploration.md)
To:    3 artifacts (exploration.md + hydrated-context.yaml + thought-cache.yaml)
       + criteria.md cho tester
```

**Yêu cầu implement — 8 files cần sửa:**

| File                                 | Change                                      | Principle refs |
| ------------------------------------ | ------------------------------------------- | -------------- |
| `SKILL.md`                           | Boot: dual context routing                  | #1, #4, #5     |
| `knowledge/exploration-standards.md` | Mở rộng Golden Standards                    | #1, #3, #5     |
| `knowledge/security-standards.md`    | YAML Resilience, sampling audit             | #5, #7         |
| `policy/output-spec.md`              | 3 artifacts → update schema                 | #4             |
| `policy/workflow.md`                 | + Phase 2.5 (hydration), 3.5 (depth verify) | #3, #5         |
| `templates/exploration.md.template`  | + hydrated-context + thought-cache refs     | #4             |
| `loop/exploration-checklist.md`      | Binary gates + META-2.1                     | #5, #6         |
| `scripts/init_context.py`            | `handle_single_init` tạo 3 artifacts        | #4             |

**Data contracts — 3 artifact output:**

```yaml
artifacts:
  - id: exploration_report
    path: '.skill-context/{target_skill}/exploration.md'
    format: markdown + frontmatter
    consumer: ['skill-architect']
  - id: hydrated_context
    path: '.skill-context/{target_skill}/hydrated-context.yaml'
    format: yaml
    size_budget: '30-50 lines'
    consumer: ['skill-planner (mandatory)', 'skill-builder (mandatory)']
  - id: thought_cache
    path: '.skill-context/{target_skill}/thought-cache.yaml'
    format: yaml
    size_budget: '100-200 lines'
    consumer: ['skill-planner (optional)', 'skill-builder (mandatory)']
  - id: test_criteria
    path: '.skill-context/{target_skill}/criteria.md'
    format: markdown
    consumer: ['skill-tester']
```

**init_context.py thay đổi — dual artifact init:**

```python
def handle_single_init(skill_name, project_root, script_dir):
    skill_dir = project_root / ".skill-context" / skill_name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "resources").mkdir(exist_ok=True)

    # v1.0: 3 artifacts thay vì 1
    for art in ("exploration.md", "hydrated-context.yaml", "thought-cache.yaml"):
        tmpl = script_dir.parent / "templates" / art
        if tmpl.is_file():
            content = replace_placeholders(tmpl.read_text(), replacements)
            safe_create_file(skill_dir / art, content)
    return 0
```

---

### (5) BINARY MECHANICAL GATES — Gate nhị phân deterministic

**Cơ chế hoạt động:**

- Tất cả gates là nhị phân — không thang điểm NLP
- Có thể verify bằng regex/script, không cần model inference
- 3 cấp độ: Hard Gate (block pipeline) | Soft Gate (warning) | Graceful Degradation (degraded)
- META-2.1 v2.0: PASS ⇔ S1 ∧ S2 ∧ S3 ∧ S4
- Sampling audit adaptive rate: 30% default → 100% on FAIL → 15% after 8 PASS

**Biểu hiện trong skill-explorer v1.0:**

- Thay thế `exploration-checklist.md` soft Q&A → META-2.1 mechanical
- YAML Resilience L1-L3 middleware trước mọi commit Context Bus
- Anti-gaming: LLM có thể giả 1-2 signal nhưng giả cả 4 → phải thực sự tư duy đa chiều

**Yêu cầu implement:**

| Gate              | Level         | Mechanism                                                     | File                              |
| ----------------- | ------------- | ------------------------------------------------------------- | --------------------------------- |
| META-2.1          | Hard/Soft     | Regex 4 signals AND                                           | `loop/exploration-checklist.md`   |
| YAML L1 Syntax    | Hard          | `yaml.safe_load()` → auto-repair (max 2)                      | `scripts/schema_validator.py`     |
| YAML L2 Schema    | Hard          | Required keys + types → auto-repair (max 2)                   | `scripts/schema_validator.py`     |
| YAML L3 Cross-ref | Hard/Degraded | Path exists, non-empty → critical=halt, non-critical=degraded | `scripts/schema_validator.py`     |
| Sampling Audit    | Adaptive      | Oracle audit 3 questions, adaptive rate                       | `knowledge/security-standards.md` |

**Fallback behavior examples:**

| Fail Trigger                       | Fallback             | Behavior                                 |
| ---------------------------------- | -------------------- | ---------------------------------------- |
| META-2.1 FAIL (missing signal)     | Hard Gate            | Block pipeline, ghi audit-fail-report    |
| META-2.1 WARNING (word_count <100) | Soft Gate            | Warning, không block                     |
| YAML L3 critical dangling ref      | Hard Halt            | Dừng pipeline, fallback stage gốc        |
| YAML L3 non-critical dangling ref  | Graceful Degradation | Continue degraded, agents defensive mode |

---

### (6) NEGATIVE SPACE DOCUMENTATION — Dạy LLM điều KHÔNG nên làm

**Cơ chế hoạt động:**

- LLM hiểu vấn đề qua cả "phải làm gì" VÀ "không được làm gì"
- Thiếu negative space → LLM chọn giải pháp an toàn nhưng sai
- Cấu trúc: `must_not` lists, anti-patterns, guardrails, S1 Negation Density

**Biểu hiện trong skill-explorer v1.0:**

**6 Anti-patterns cụ thể cho explorer:**

| Anti-pattern                                     | Hậu quả                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| Single-stream output (gộp technical + cognitive) | Planner mang depth không cần; file phình to        |
| Soft-only checklist (không binary gate)          | LLM "tăng điểm" bằng padding; không verify script  |
| Thought block <200 từ                            | Mất cognitive depth; code đúng contract sai intent |
| Hallucinate khi thiếu docs                       | Builder implement sai                              |
| Edit workspace code ngoài `.skill-context/`      | Vi phạm G1_DesignOnly guardrail                    |
| Skip HITL khi confidence <70%                    | Sai intent; tốn rebuild                            |

**Yêu cầu implement:**

| Component                     | Detail                                            | File                                       |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------ |
| `must_not` list               | Field bắt buộc trong hydrated-context.yaml schema | `templates/hydrated-context.yaml.template` |
| Anti-patterns section         | 6 anti-patterns trong domain-handbook             | `domain-handbook.md §4.A`                  |
| S1 Negation gate              | Regex `must_not` / `không` trong thought block    | `loop/exploration-checklist.md`            |
| Guardrail defensive reasoning | Mapping guardrail → rationale trong thought-cache | `thought-cache.yaml` schema                |
| META-2.1 S1 signal            | "must_not" in block.lower()                       |                                            | "không" in block | META-2.1 gate |

**Edge cases cụ thể:**

| #   | Edge case                               | Expected behavior                       |
| --- | --------------------------------------- | --------------------------------------- |
| E5  | Thought block thiếu 1/4 META-2.1 signal | Binary gate FAIL hoặc WARNING           |
| E6  | Confidence <70%                         | Dừng pipeline, hỏi user (G5_HITL)       |
| E7  | Network egress blocked                  | Graceful degradation, mark [CẦN LÀM RÕ] |

---

### (7) GRACEFUL DEGRADATION — Pipeline không Hard Halt khi lỗi non-critical

**Cơ chế hoạt động:**

- 3 chế độ pipeline: Normal → Degraded → Halt
- Fallback Matrix F1-F19: max 3 iterations/stage, append-only history, root cause first
- Context Bus KHÔNG reset khi fallback — chỉ append version mới
- Soft gates warning không block pipeline

**Biểu hiện trong skill-explorer v1.0:**

**Fallback subset cần implement cho v1.0:**

| Case                      | Trigger                    | Behavior                            | Priority |
| ------------------------- | -------------------------- | ----------------------------------- | -------- |
| F4                        | Audit FAIL → 100% sampling | Re-validate Stage 1.5               | HIGH     |
| F8-EXT                    | Design sai sau audit       | Quay Stage 1 (revise) hoặc Stage 0  | HIGH     |
| E7                        | Network fetch blocked      | Degraded: nội bộ, mark [CẦN LÀM RÕ] | MEDIUM   |
| Token budget >700         | Soft gate                  | Warning, không block                | MEDIUM   |
| Thought-cache >200 dòng   | Soft gate                  | Warning, không block                | MEDIUM   |
| Non-critical dangling ref | YAML L3                    | Degraded mode, defensive mode       | LOW      |

**Pipeline state machine (v1.0):**

```
Normal:  Phase 1 → 2 → 2.5 → 3 → 3.5 → 4
                                   │
                          Soft Gate Warning?
                                   │ (no)
                          Normal → continue
                                   │ (yes)
                          Degraded → mark [DEGRADED] → continue
                                   │
                          Hard Gate Fail?
                                   │ (no) → continue
                                   │ (yes) → HALT → fallback
```

**Quy tắc fallback:**

1. Max **3 iterations** per stage → escalate Oracle/user
2. **Append-only** fallback history trong `_state.yaml.fallback_history`
3. **Root cause first**: fallback stage gần nhất → nếu lặp → fallback sâu hơn
4. **Context Bus preserve**: KHÔNG reset khi fallback, chỉ append version mới

---

## ⚡ Priority & Implementation Roadmap cho Architect

### P0 — Foundation (blocking)

| Action                                           | Files                                      | Dependencies    |
| ------------------------------------------------ | ------------------------------------------ | --------------- |
| Thiết kế `thought-cache.yaml` schema             | `templates/thought-cache.yaml.template`    | Q1, Q4          |
| Thiết kế `hydrated-context.yaml` schema          | `templates/hydrated-context.yaml.template` | Q1, Q4          |
| Update `exploration.schema.yaml` cho dual stream | `schemas/exploration.schema.yaml`          | **Q1 blocking** |

### P1 — Pipeline & Artifacts

| Action                                 | Files                     | Dependencies             |
| -------------------------------------- | ------------------------- | ------------------------ |
| Thêm Phase 2.5 Context Hydration       | `policy/workflow.md`      | Hydrator subagent design |
| Thêm Phase 3.5 Depth Verify            | `policy/workflow.md`      | META-2.1 gate design     |
| Update `init_context.py` dual artifact | `scripts/init_context.py` | Template files done      |
| Update `handle_split_run()`            | `scripts/init_context.py` | `init_context.py` done   |

### P2 — Quality Gates

| Action                          | Files                             | Dependencies        |
| ------------------------------- | --------------------------------- | ------------------- |
| Implement META-2.1 binary gate  | `loop/exploration-checklist.md`   | Q7 phasing decision |
| Implement YAML Resilience L1-L3 | `scripts/schema_validator.py`     | Schema design done  |
| Sampling audit config           | `knowledge/security-standards.md` | Security audit      |

### P3 — Content & Resilience

| Action                                 | Files                         | Dependencies      |
| -------------------------------------- | ----------------------------- | ----------------- |
| Add anti-patterns section              | `knowledge/*.md`              | Handbook ready    |
| Enrich `must_not` lists                | Templates, contracts          | Q6 scope decision |
| Implement fallback subset (F4, F8-EXT) | `protocols-and-state-spec.md` | Q6 scope decision |

---

## ⚠️ Open Issues cần resolve trước build

| #      | Question                                       | Impact                           | Suggested                                      |
| ------ | ---------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| **Q1** | exploration.schema.yaml hỗ trợ multi-artifact? | **Blocking** — schema validation | Tách riêng schema cho mỗi artifact             |
| **Q5** | SCS single-pass vs 2-phase?                    | Pipeline redesign                | 2-phase (Stage 0.5 + 1.5) theo synthesis       |
| **Q6** | Subset hay full F1-F19?                        | Scope sizing                     | Chỉ implement F4, F8-EXT cho v1.0              |
| **Q7** | META-2.1 implement ngay Stage 0?               | Phasing                          | Implement ở Stage 0 (explorer output)          |
| **Q8** | Sampling rate 30% phù hợp?                     | Rate tuning                      | 30% cho exploration là hợp lý (low-risk stage) |

---

## 📋 Tổng Kết — Matrix Tác Động

| Principle                |                 Data Contracts |            Quality Gates |           Workflow Phases | Files Changed |
| :----------------------- | -----------------------------: | -----------------------: | ------------------------: | ------------: |
| 1 Domain Anchoring       |    `thought-cache.yaml` schema |           META-2.1 S1-S4 |    Phase 3.5 Depth Verify |             3 |
| 2 Semantic over Ceremony |           Contract size budget |         Binary AND gates |                         — |             2 |
| 3 Context Pre-processing | `hydrated-context.yaml` schema |                        — | Phase 2.5 Hydration (NEW) |             2 |
| 4 Dual Knowledge Stream  |        3 artifacts → consumers |                        — |        Dual-write Phase 4 |             8 |
| 5 Binary Gates           |                              — |    YAML L1-L3 + META-2.1 |                         — |             2 |
| 6 Negative Space         |       must_not + anti-patterns |                  S1 gate |                         — |             2 |
| 7 Graceful Degradation   |        Fallback history schema | Sampling audit, Fallback |      Degraded mode states |             2 |
