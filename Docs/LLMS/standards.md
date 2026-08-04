# LLM Knowledge Activation Documentation Standard

## 1. Mục đích

Tài liệu này chuẩn hóa cách biến tri thức thô thành tài liệu dành cho LLM và AI coding agents. Mục tiêu không chỉ là giúp mô hình “đọc hiểu”, mà còn tạo ra các tín hiệu cấu trúc đủ rõ để đánh thức đúng cụm tri thức, đúng hành vi và đúng mức ưu tiên bên trong mô hình lớn.

Tài liệu chuẩn phải giúp agent:

- Nhận biết đâu là luật bắt buộc.
- Phân biệt instruction, context, example, evidence và output contract.
- Nạp đúng lượng tri thức theo task.
- Giảm suy đoán khi ra quyết định.
- Hành động ổn định trong coding workflow hoặc knowledge workflow.
- Dễ được con người kiểm tra, chỉnh sửa và mở rộng.

---

## 2. Nguyên lý lõi

LLM không xử lý Markdown, YAML hay XML như compiler. Mô hình phản ứng với các mẫu cấu trúc đã gặp trong huấn luyện và với ranh giới ngữ nghĩa được prompt thể hiện.

Vì vậy, format tốt không phải là format đẹp nhất, mà là format giúp mô hình trả lời nhanh các câu hỏi sau:

```yaml
semantic_questions:
  - đây là mệnh lệnh hay dữ liệu tham chiếu?
  - đây là luật bắt buộc hay gợi ý mềm?
  - thông tin này luôn cần dùng hay chỉ dùng theo ngữ cảnh?
  - phần nào là ví dụ, phần nào là tiêu chí chấp nhận?
  - khi có xung đột, ưu tiên nào cao hơn?
```

Nguyên tắc thiết kế:

```yaml
principles:
  encode_intent_over_decoration: true
  separate_rules_from_context: true
  separate_examples_from_instructions: true
  keep_root_guide_compact: true
  load_domain_context_on_demand: true
  prefer_named_schema_over_implicit_notes: true
  avoid_large_flat_markdown: true
```

---

## 3. Vai trò của từng format

### 3.1 Markdown

Markdown dùng cho phần cần đọc hiểu tự nhiên:

- overview
- rationale
- architecture explanation
- onboarding
- glossary
- domain explanation
- walkthrough
- decision notes
- bảng so sánh
- ví dụ có ngữ cảnh

Markdown phù hợp khi mục tiêu là giúp người và agent hiểu bối cảnh. Không nên dùng Markdown phẳng để chứa toàn bộ luật cứng, checklist, exception và policy vì mô hình dễ xem luật như ghi chú mềm.

#### Quy chuẩn Định dạng Markdown Bắt buộc cho AI Agent & Lập trình viên:

1. **Clickable File Links (Đường dẫn File click được)**:
   - Bắt buộc tạo liên kết dạng click được cho các file và biểu tượng code (class, function, struct) bằng cú pháp: `[tên_file](file:///đường_dẫn_tuyệt_đối_đến_file)`.
   - Đối với liên kết dòng cụ thể, sử dụng định dạng: `[tên_file:L123-145](file:///đường_dẫn_file#L123-L145)`.
   - **QUAN TRỌNG**: Không bao bọc phần text hiển thị của link bằng dấu backticks (ví dụ: `[utils.py](file://...)` là ĐÚNG, `[`utils.py`](file://...)` là SAI vì sẽ làm hỏng khả năng hiển thị link trên giao diện chat/IDE).
   - Nếu nhúng hình ảnh/video, bắt buộc dùng cú pháp `![caption](/đường_dẫn_tuyệt_đối)`.

2. **GitHub-style Alerts (Các khối cảnh báo)**:
   - Sử dụng các cảnh báo tiêu chuẩn của GitHub để phân cấp mức độ quan trọng:
     > [!NOTE]
     > Dành cho ngữ cảnh nền, chi tiết triển khai hoặc giải thích bổ sung.
     > [!TIP]
     > Dành cho tối ưu hiệu năng, thực hành tốt (best practices) hoặc mẹo nâng cao hiệu suất.
     > [!IMPORTANT]
     > Dành cho các yêu cầu bắt buộc, các bước quan trọng phải nhớ.
     > [!WARNING]
     > Cảnh báo về thay đổi lớn (breaking changes), vấn đề tương thích hoặc lỗi tiềm ẩn.
     > [!CAUTION]
     > Cảnh báo rủi ro cao có thể gây mất mát dữ liệu hoặc vi phạm bảo mật.

3. **Code & Diffs (Khối mã và So sánh thay đổi)**:
   - Chỉ định ngôn ngữ rõ ràng cho các khối code (ví dụ: ````typescript ... ````).
   - Sử dụng khối `diff` để mô tả trực quan các thay đổi của code. Đánh dấu dòng thêm mới bằng `+` và dòng bị xóa/thay thế bằng `-`:
     ```diff
     - old_function_name()
     + new_function_name()
       unchanged_line()
     ```

4. **Mermaid Diagrams (Biểu đồ luồng)**:
   - Sử dụng khối mã `mermaid` để trực quan hóa luồng dữ liệu, quan hệ hoặc kiến trúc.
   - Để tránh lỗi cú pháp, bọc các nhãn chứa ký tự đặc biệt trong dấu ngoặc kép (ví dụ: `id["Nhãn (thông tin bổ sung)"]` thay vì không bọc) và tránh dùng các thẻ HTML bên trong nhãn.

5. **Tables (Bảng dữ liệu)**:
   - Sử dụng định dạng bảng Markdown tiêu chuẩn để trình bày dữ liệu có tính chất so sánh, đối chiếu hoặc cấu trúc đa chiều nhằm tối ưu khả năng quét thông tin của mô hình và con người.

6. **Carousels (Trình diễn slide)**:
   - Sử dụng khối mã ```carousel để nhóm các nội dung liên quan (ảnh mockup, diff code, sơ đồ) cần hiển thị tuần tự. Phân tách các slide bằng comment HTML `<!-- slide -->`.


### 3.2 YAML

YAML dùng cho tri thức có tính cấu hình, policy hoặc schema hành vi:

```yaml
recommended_yaml_keys:
  - must
  - must_not
  - should
  - priority_order
  - constraints
  - scope
  - allowed_tools
  - forbidden_patterns
  - output_contract
  - acceptance_criteria
  - routing_rules
  - stop_conditions
  - validation_checklist
```

YAML giúp mô hình kích hoạt kiểu tư duy cấu hình: đọc khóa, hiểu quan hệ, tuân thủ ràng buộc. Dùng YAML khi muốn giảm mơ hồ và biến ý định thành trường dữ liệu có tên rõ ràng.

Không nên nhồi prose dài vào YAML. Khi YAML quá dài hoặc lồng quá sâu, nó mất lợi thế schema và trở nên khó bảo trì.

### 3.3 XML-like tags

XML-like tags dùng để tạo ranh giới ngữ nghĩa mạnh giữa các khối:

```xml
<instructions>Luật điều khiển hành vi.</instructions>
<context>Dữ liệu tham chiếu, không phải lệnh.</context>
<examples>Ví dụ minh họa pattern đúng.</examples>
<input>Thông tin người dùng hoặc tài liệu nguồn.</input>
<output_contract>Định dạng đầu ra bắt buộc.</output_contract>
```

XML đặc biệt hữu ích khi prompt có nhiều thành phần hoặc có dữ liệu người dùng/RAG/spec đi kèm. Nó giúp tránh lỗi mô hình nhầm dữ liệu tham chiếu thành instruction.

Không nên bọc vi mô từng dòng bằng XML. XML tốt nhất khi làm delimiter cho khối lớn và tên tag mang nghĩa rõ.

---

## 4. Quy tắc chọn format

```yaml
format_selection_rules:
  markdown:
    use_for:
      - explanation
      - architecture
      - rationale
      - onboarding
      - domain_knowledge
      - human_readable_docs
    avoid_for:
      - hard_rules_without_schema
      - long_mixed_policy_blocks

  yaml:
    use_for:
      - constraints
      - policies
      - checklists
      - routing
      - permission_maps
      - output_contracts
      - acceptance_criteria
    avoid_for:
      - long_prose
      - complex_narrative_context
      - deeply_nested_documents

  xml_like_tags:
    use_for:
      - semantic_boundaries
      - separating_context_from_instruction
      - wrapping_examples
      - wrapping_external_input
      - parseable_output_sections
    avoid_for:
      - excessive_micro_tagging
      - replacing_all_markdown
      - deeply_nested_prompt_trees
```

---

## 5. Mô hình 4 lớp tri thức

Một hệ tài liệu tốt nên được phân tầng theo mức độ luôn cần thiết của tri thức.

```yaml
knowledge_layers:
  L0_anchor_rules:
    purpose: "Luật nền, mục tiêu, giới hạn tuyệt đối, anti-goals."
    load_policy: "always"
    location: "root guide: CLAUDE.md, AGENT.md, SYSTEM.md"
    preferred_format: "Markdown ngắn + YAML ngắn + XML boundary"

  L1_working_policy:
    purpose: "Quy ước làm việc, coding rules, review rules, tool rules, output contract."
    load_policy: "frequent_or_scoped"
    location: "docs/agent/policies hoặc .claude/rules"
    preferred_format: "YAML + Markdown ngắn"

  L2_domain_context:
    purpose: "Kiến trúc, domain glossary, data flow, ADR, subsystem notes."
    load_policy: "on_demand"
    location: "docs/architecture, docs/domains, docs/runbooks"
    preferred_format: "Markdown chủ đạo, có YAML snippets khi cần"

  L3_evidence_examples:
    purpose: "Spec, ticket, logs, examples, fixtures, reference docs."
    load_policy: "task_specific_only"
    location: "specs, examples, tickets, tmp/context"
    preferred_format: "XML wrapper + Markdown/YAML bên trong"
```

Luật vận hành: root guide chỉ nên chứa L0 và phần cô đặc nhất của L1. L2 và L3 phải được tách để nạp theo task.

---

## 6. Token budget khuyến nghị

Các ngưỡng dưới đây là vùng vận hành thực tế, không phải giới hạn lý thuyết của context window.

```yaml
token_budget_by_layer:
  L0_anchor_rules:
    good: "150-400 tokens"
    warning: "500-700 tokens"
    split_when: ">700 tokens"

  L1_working_policy:
    good: "400-1200 tokens"
    warning: "1200-2000 tokens"
    split_when: ">2000 tokens"

  L2_domain_context:
    good: "600-2500 tokens"
    warning: "2500-5000 tokens"
    split_when: ">5000 tokens"

  L3_evidence_examples:
    good: "300-2000 tokens"
    warning: "2000-6000 tokens"
    split_when: ">6000 tokens"
```

```yaml
token_budget_by_format:
  markdown_section:
    light: "100-400 tokens"
    medium: "400-900 tokens"
    heavy: "900-1800 tokens"
    overloaded: ">1800 tokens"

  yaml_block:
    light: "80-300 tokens"
    medium: "300-700 tokens"
    heavy: "700-1200 tokens"
    overloaded: ">1200 tokens"

  xml_block:
    light: "50-250 tokens"
    medium: "250-800 tokens"
    heavy: "800-1500 tokens"
    overloaded: ">1500 tokens"

  root_guide_total:
    excellent: "300-900 tokens"
    good: "900-1800 tokens"
    warning: "1800-3000 tokens"
    heavy: "3000-5000 tokens"
    overloaded: ">5000 tokens"
```

Nếu root guide vượt 1800–3000 tokens, cần kiểm tra xem nó có đang chứa quá nhiều domain context, examples hoặc prose không. Nếu vượt 5000 tokens, gần như chắc chắn cần tái cấu trúc thành nhiều lớp.

### 6.1 Quy đổi Token tham chiếu (Ước tính)

Token không phải là byte hay ký tự, và không có tỷ lệ quy đổi cố định 1:1. Tuy nhiên, có thể sử dụng bảng tham chiếu sau để ước lượng dung lượng:

| Tokens | Ngôn ngữ | Ký tự (ước tính) | Bytes (ASCII/UTF-8) | Bits |
| :--- | :--- | :--- | :--- | :--- |
| **100** | Tiếng Anh | ~400 | ~400 | ~3,200 |
| | Tiếng Việt | 300 - 500 | 300 - 500 | 2,400 - 4,000 |
| **500** | Tiếng Anh | ~2,000 | ~2,000 | ~16,000 |
| | Tiếng Việt | 1,500 - 2,500 | 1,500 - 2,500 | 12,000 - 20,000 |
| **700** | Tiếng Anh | ~2,800 | ~2,800 | ~22,400 |
| | Tiếng Việt | 2,100 - 3,500 | 2,100 - 3,500 | 16,800 - 28,000 |
| **1,000** | Tiếng Anh | ~4,000 | ~4,000 | ~32,000 |
| | Tiếng Việt | 3,000 - 5,000 | 3,000 - 5,000 | 24,000 - 40,000 |

**Lưu ý kỹ thuật:**
- **Tiếng Anh:** Trung bình 1 token ≈ 4 ký tự.
- **Tiếng Việt:** Dao động mạnh (thường 3-5 ký tự/token) tùy cách viết, từ ghép, dấu và ký tự đặc biệt.
- **Dung lượng:** 1 ký tự ≈ 1 byte (ASCII). Với tiếng Việt có dấu, UTF-8 có thể dùng 2-4 bytes cho một số ký tự, nên số byte thực tế thường lớn hơn số ký tự.
- **Quy đổi Bit:** 1 byte = 8 bits.

---

## 7. Cấu trúc root guide khuyến nghị

Root guide không phải kho kiến thức. Nó là “bản hiến pháp + bản đồ nạp context”.

````markdown
# Project Agent Guide

## Purpose

Mô tả ngắn dự án, domain, và định nghĩa thành công.

<instructions>
Luôn ưu tiên thay đổi an toàn, giữ backward compatibility, bảo vệ dữ liệu người dùng, và chỉ sửa đúng phạm vi task.
</instructions>

## Core Policy

```yaml
priority_order:
  - user_task
  - source_fidelity
  - safety
  - maintainability
  - minimal_change

constraints:
  must:
    - preserve public APIs unless task explicitly allows breaking changes
    - write or update tests for changed business logic
    - keep changes scoped to the requested task
  must_not:
    - edit generated files directly
    - introduce new dependencies without justification
    - remove existing behavior without migration notes

output_contract:
  include:
    - summary_of_changes
    - files_changed
    - validation_performed
    - remaining_risks
```
````

## Working Map

```yaml
load_when_needed:
  output_format_rules: ".claude/rules/output-format.md"
  backend_rules: ".claude/rules/backend.md"
  frontend_rules: ".claude/rules/frontend.md"
  testing_policy: "docs/agent/test-policy.yaml"
  architecture_overview: "docs/architecture/overview.md"
  domain_docs: "docs/domains/"
  examples: "docs/examples/"
```

## Interaction Protocol

```yaml
agent_protocol:
  before_editing:
    - inspect relevant files
    - identify scope and risk
    - load scoped rules if available
  during_editing:
    - prefer minimal safe changes
    - preserve existing patterns
    - document assumptions
  before_final_response:
    - run available validation when practical
    - state what was and was not verified
```

````

---

## 8. Kiến trúc tài liệu nhiều lớp

Khi dự án lớn hơn, nên chuyển từ một file lai sang hệ thống nhiều file.

```text
repo/
├─ CLAUDE.md                         # L0: constitution / non-negotiables
├─ .claude/
│  ├─ rules/
│  │  ├─ backend.md                  # L1: scoped working policy
│  │  ├─ frontend.md
│  │  ├─ infra.md
│  │  └─ testing.md
│  └─ skills/
│     ├─ api-design.md               # L1/L2: skill-specific playbooks
│     ├─ migration-safety.md
│     └─ release-checks.md
├─ docs/
│  ├─ architecture/                  # L2: system understanding
│  ├─ domains/                       # L2: business/domain knowledge
│  ├─ runbooks/                      # L2: procedures
│  └─ adr/                           # L2: decisions and rationale
├─ specs/                            # L3: task-specific requirements
└─ examples/                         # L3: examples and fixtures
````

Phân bổ mặc định:

```yaml
document_distribution:
  root_guide:
    role: "control + navigation"
    content: "mission, hard rules, priority order, loading map"
    format: "hybrid markdown/yaml/xml"

  policy_files:
    role: "repeatable behavioral rules"
    content: "coding policy, testing policy, review policy"
    format: "yaml or structured markdown"

  architecture_docs:
    role: "system understanding"
    content: "module map, data flow, runtime model, ADR summary"
    format: "markdown"

  domain_docs:
    role: "business/domain semantics"
    content: "entities, workflows, edge cases, glossary"
    format: "markdown + tables + snippets"

  task_specs:
    role: "current task requirements"
    content: "task, context, acceptance criteria, constraints"
    format: "xml-wrapped markdown/yaml"

  examples:
    role: "pattern retrieval"
    content: "good/bad examples, fixtures, failure cases"
    format: "markdown code blocks, optional xml wrapper"
```

---

## 9. Semantic activation anchors

Các từ khóa sau nên được dùng nhất quán vì chúng kích hoạt những pattern quen thuộc trong mô hình lớn.

```yaml
activation_anchors:
  high_priority_rules:
    - instructions
    - non_negotiables
    - hard_rules
    - constraints
    - must
    - must_not
    - priority_order

  task_execution:
    - task
    - scope
    - assumptions
    - plan
    - steps
    - stop_conditions
    - validation

  quality_control:
    - acceptance_criteria
    - review_checklist
    - test_policy
    - definition_of_done
    - output_contract
    - risk_notes

  context_boundaries:
    - context
    - reference
    - examples
    - evidence
    - input
    - retrieved_docs

  routing_and_loading:
    - load_when_needed
    - routing_rules
    - domain_map
    - file_map
    - relevant_context
```

Tên khóa phải ổn định giữa các file. Không nên dùng nhiều biến thể cho cùng một ý nghĩa như `avoid`, `do_not`, `never_do`, `forbidden` nếu không có lý do rõ ràng. Hãy chọn một schema và dùng nhất quán.

---

## 10. Mẫu task context chuẩn

Khi đưa spec, ticket, log hoặc tài liệu RAG vào prompt, dùng cấu trúc phân ranh rõ:

````xml
<task>
Refactor payment retry flow without changing public API behavior.
</task>

<context>
Thông tin kiến trúc, module liên quan, ràng buộc hệ thống, hoặc trích đoạn tài liệu.
</context>

<constraints>
```yaml
must:
  - preserve existing API contract
  - keep retry count configurable
  - ensure retry operation is idempotent
must_not:
  - change database schema without migration plan
  - introduce new external dependencies
````

</constraints>

<acceptance_criteria>

```yaml
criteria:
  - existing tests pass
  - new tests cover retry edge cases
  - no duplicate payment charge is possible under repeated retries
  - failure path returns the documented error shape
```

</acceptance_criteria>

<examples>
Các ví dụ request/response hoặc pattern đúng.
</examples>
```

---

## 11. Quy tắc chống quá tải

```yaml
overload_detection:
  markdown:
    smell:
      - section mixes explanation, rules, exceptions, examples
      - section exceeds 900 tokens and keeps growing
    fix:
      - move policy into YAML
      - split domain context into separate docs
      - keep only overview in root

  yaml:
    smell:
      - block exceeds 700-1200 tokens
      - indentation depth exceeds 3-4 levels
      - multiple domains appear in one policy block
    fix:
      - split by domain or workflow
      - flatten schema
      - move explanations to Markdown

  xml:
    smell:
      - tags wrap nearly every sentence
      - nested tags make prompt harder to scan
      - delimiter text feels larger than content value
    fix:
      - use outer block tags only
      - use semantic tag names
      - move internal structure to Markdown/YAML

  root_guide:
    smell:
      - grows after every sprint
      - contains many examples and logs
      - replaces docs/ instead of pointing to docs/
    fix:
      - keep only L0 and minimal L1
      - add working map
      - move L2/L3 to scoped files
```

---

## 12. Definition of Done cho tài liệu AI-first

Một tài liệu đạt chuẩn khi thỏa các điều kiện sau:

```yaml
definition_of_done:
  source_fidelity:
    - preserves original meaning
    - does not invent missing requirements
    - marks assumptions explicitly

  structure:
    - separates instructions, context, examples, and output contract
    - uses Markdown for explanation
    - uses YAML for policy/schema
    - uses XML-like tags for semantic boundaries

  agent_usability:
    - contains priority order
    - contains must and must_not rules when applicable
    - contains loading/routing guidance for extra context
    - contains acceptance criteria or validation checklist

  token_awareness:
    - root guide stays compact
    - long context moves to scoped docs
    - examples do not dominate root
    - repeated schema keys are consistent

  maintainability:
    - humans can inspect and update sections safely
    - each file has one clear role
    - no section mixes too many information types
```

---

## 13. Tóm tắt áp dụng

```yaml
core_summary:
  markdown: "Giải thích và truyền đạt bối cảnh."
  yaml: "Mã hóa luật, checklist, constraints và output contract."
  xml_like_tags: "Tạo ranh giới giữa instruction, context, examples và input."
  root_guide: "Giữ luật nền và bản đồ nạp context, không làm kho tri thức."
  domain_docs: "Chỉ nạp khi task cần."
  examples: "Để riêng, dùng cho retrieval hoặc đối chiếu pattern."
  best_architecture: "Hybrid format + layered documentation + on-demand context loading."
```

Câu hỏi thiết kế đúng không phải là “format nào mạnh nhất”, mà là:

> Loại thông tin này nên được biểu diễn dưới hình thức nào để mô hình hiểu đúng ý định với ít suy đoán nhất?
> Khi tài liệu trả lời được câu hỏi đó, nó không chỉ là hướng dẫn đọc hiểu. Nó trở thành hệ thống điều hướng tri thức cho LLM.
