# 🧠 Tổng hợp Nguyên lý Cốt lõi: LLM Semantic Activation, Vector Space Triggering, Quality Gate & Document Structure

> **Nguồn:** `WASHVN/Temps/clean/` — phân tích từ 6 file (scope, architecture-design, orchestrator-agent-spec, protocols-and-state-spec, supplements/reflection-cache-spec, supplements/depth-gate-criteria)
> **Ngày:** 2026-07-10
> **Mục đích:** Trích xuất nguyên lý thiết kế, không chỉ tóm tắt nội dung.

---

## (1) LLM SEMANTIC ACTIVATION — Cách "đánh thức" không gian ngữ nghĩa của LLM

### 1.1 Semantic Anchor — Mỏ neo ngữ nghĩa

**Nguyên lý:** LLM cần các **mỏ neo vector ngôn ngữ** (linguistic vector anchors) để được "kích hoạt" đúng không gian ngữ nghĩa trước khi thực hiện nhiệm vụ. Nếu thiếu, LLM code/suy luận trong "khoảng trống ngữ nghĩa" (semantic void).

**Cơ chế từ WASHVN:**

```text
BA Elicitor → sinh thought blocks (>200 từ) → thought-cache.yaml
→ Builder Phase 1: "bơm thought blocks làm mỏ neo vector ngôn ngữ"
→ Domain Anchoring (Nguyên tắc #1) được khôi phục
```

**Các loại semantic anchor:**

- **Domain Glossary** (≥10 thuật ngữ chuyên ngành) — định danh không gian
- **Thought Blocks** (phân tích nghiệp vụ sâu) — mỏ neo ngữ cảnh; artifact `thought-cache.yaml` có kích thước ~100-200 dòng YAML (không phải số từ của một block — trong spec v1.0, mỗi thought block yêu cầu >200 từ)
- **Stakeholder Empathy** (hiểu "code cho ai, vì sao, đau ở đâu") — mỏ neo giá trị
- **Defensive Reasoning** (lý do tồn tại của guardrails) — mỏ neo ràng buộc

> [!IMPORTANT]
> **Phát hiện then chốt:** [architecture-design.md](file:///home/stveve/Documents/workspace/build-workflow/WASHVN/Temps/clean/architecture-design.md) dòng 418 ("Loại bỏ prose thừa, chỉ giữ semantic anchors") là một **vết cắt nguy hiểm** — chính các "prose thừa" đó lại là cognitive depth mà LLM cần. Reflection Cache ra đời để giải quyết vết cắt này: giữ NGUYÊN VẸN thought blocks thay vì nén mất. (Lưu ý: [reflection-cache-spec.md](file:///home/stveve/Documents/workspace/build-workflow/WASHVN/Temps/clean/supplements/reflection-cache-spec.md) dòng 29 cũng trích câu này nhưng ghi nhầm là "dòng 397" — số dòng đúng trong architecture-design.md là 418.)

### 1.2 Nguyên lý Semantic Density over Ceremony

**Nguyên lý:** LLM hoạt động tốt hơn với nội dung **đậm đặc ngữ nghĩa** (semantic density) hơn là format cầu kỳ (ceremony). Thiết kế tài liệu cho LLM cần ưu tiên:

- Nội dung giàu ngữ nghĩa > Format đẹp, chuẩn mực
- Data contracts xác định (input_schema/output_schema) > Mô tả dài dòng
- Binary gates cơ học > Thang điểm chủ quan

**Biểu hiện trong kiến trúc:**

- Hydrated context chỉ giữ: glossary, NFR, edge cases, data contracts, zone map, must_not — loại bỏ prose
- Todo.md < 1200 tokens — ép LLM planner tập trung
- Quality gates dạng binary Pass/Fail, không thang điểm

### 1.3 Dual Context Ingestion — Song sinh kỹ thuật + nhận thức

**Nguyên lý:** LLM cần **hai luồng thông tin song song** để hiểu đúng vấn đề:

1. **Technical scaffolding** (`hydrated-context.yaml`): biết "phải code gì"
2. **Cognitive depth** (`thought-cache.yaml`): biết "vì sao code như vậy, code cho ai"

| Khía cạnh   | Technical Contracts      | Cognitive Depth                    |
| :---------- | :----------------------- | :--------------------------------- |
| Artifact    | `hydrated-context.yaml`  | `thought-cache.yaml`               |
| Dung lượng  | ~30-50 dòng YAML         | ~100-200 dòng YAML                 |
| Bản chất    | Glossary, NFR, contracts | Thought blocks, empathy, reasoning |
| Planner đọc | ✅ BẮT BUỘC              | ⚡ TÙY CHỌN                        |
| Builder đọc | ✅ BẮT BUỘC              | ✅ BẮT BUỘC                        |

> [!NOTE]
> **Ý nghĩa sâu xa:** LLM không chỉ cần biết "WHAT" (technical contracts) mà còn cần "WHY" + "WHO" + "WHAT IF". Thiếu cognitive depth, LLM code đúng contract nhưng sai intent — đây là lý do Reflection Cache được thiết kế như artifact riêng, không nhồi vào inline block.

---

## (2) VECTOR SPACE TRIGGERING — Cách kích hoạt không gian vector của LLM

### 2.1 Domain Anchoring (Nguyên tắc #1)

**Nguyên lý:** LLM hoạt động trong không gian vector ngữ nghĩa — cần được **neo đậu** (anchored) vào đúng vùng không gian đó trước khi suy luận. Nếu neo sai vùng, output sẽ lệch semantic dù technical đúng.

**Cơ chế trigger:**

```text
[Input thô]
  → BA Elicitor: xác định domain, glossary (10+ terms)
  → Miner: domain-handbook với keyword triggers
  → Architect: semantic anchors trong design.md
  → Hydrator: inject thought blocks làm mỏ neo vector
  → Builder: code với LLM đã được "kích hoạt" đúng không gian
```

**Ví dụ cụ thể từ spec:** Nếu domain là "Fintech/Payment Gateways", glossary gồm: OTP, Nonce, HMAC-SHA256, Replay Attack, Idempotency-Key — các từ này kích hoạt vùng vector liên quan đến bảo mật tài chính trong không gian ngữ nghĩa của LLM.

### 2.2 SCS Score — Đo "khoảng cách vector" của vấn đề

**Nguyên lý:** **Skill Complexity Score (SCS)** 1.0-5.0 là phép đo độ phức tạp ngữ nghĩa của bài toán. Nó quyết định:

- **SCS < 3.0**: Vấn đề đơn giản, 1 domain — Fast Track (Phase Compression)
- **SCS >= 3.0**: Vấn đề phức tạp, đa domain — Full Track OMSP (13 stages)

**Cơ chế 2-phase:**

1. **Stage 0.5** (pre-pass): Định tuyến sớm — Architect biết cần orchestration-plan hay không
2. **Stage 1.5** (validate): Spec Gatekeeper validate lại SCS score sau khi có design → có thể re-route (F4)

> [!TIP]
> **Tương đồng với vector search:** SCS giống như độ đo "semantic distance" — vấn đề càng nhiều domain càng xa trong không gian vector → càng cần pipeline dài hơn, nhiều subagent hơn.

### 2.3 Semantic Sampling Audit — Lớp trigger xác suất

**Nguyên lý:** Không thể kiểm tra semantic meaning của mọi output LLM (tốn kém). Thay vào đó, dùng **audit xác suất** với adaptive rate:

- Default: 30% sampling
- Ngay khi có FAIL → nhảy lên 100% (Hard Gate)
- 8 lần PASS liên tiếp → giảm xuống 15% relaxation

**Hiệu ứng răn đe (deterrence effect):** LLM biết có ~30% kiểm tra ngẫu nhiên → tự động ép deeper thinking — giống randomized testing trong security.

**Cơ chế Oracle Audit:**

- Oracle subagent trả lời 3 câu hỏi AUDIT-1 → 3
- Nếu PASS → pipeline tiếp tục
- Nếu FAIL → F8-EXT: ghi audit-fail-report.md → quay Stage 1 (design sai) hoặc Stage 0 (plan sai intent)

### 2.4 Thought Latency Theory

**Nguyên lý từ META-2.1 v2.0:** Không đo **độ dài** tư duy (số từ), đo **kiểu tư duy** (4 Depth Signals). Ép LLM "chững lại phân tích đa chiều" thay vì trả lời nhanh, nông.

Bốn tín hiệu tương ứng với 4 chiều của không gian vector tư duy:

- **S1 (Negation Density)**: Không gian negative — điều KHÔNG nên làm
- **S2 (Reverse Question)**: Không gian defensive — điều gì có thể sai
- **S3 (Multi-Stakeholder)**: Không gian social — ai bị ảnh hưởng
- **S4 (Constraint Anchoring)**: Không gian thực tế — ràng buộc cụ thể

> [!IMPORTANT]
> **Anti-gaming:** LLM có thể giả mạo 1-2 signal nhưng để giả cả 4, nó phải thực sự thực hiện tư duy đa chiều — lúc đó gate đã thành công.

---

## (3) QUALITY GATE DESIGN CHO LLM — Thiết kế cổng kiểm soát chất lượng

### 3.1 Nguyên lý Binary AND (Mechanical Verification)

**Tất cả gates trong WASHVN đều là nhị phân — không có thang điểm:**

```text
META-2.1 v2.0 PASS  ⇔  (S1 present) AND (S2 present) AND (S3 present) AND (S4 present)
                   = FAIL  ⇔  ANY signal missing
                   = WARNING (không fail) ⇔ word_count < 100
```

**Tại sao binary?**

- **Deterministic**: Có thể kiểm tra bằng regex/script, không cần model inference
- **Không gameable**: LLM không thể "tăng điểm" bằng padding
- **Mechanical verification** (Nguyên tắc #5): Mọi gate phải chạy lệnh kiểm chứng

### 3.2 Phân loại Gate — 3 cấp độ

| Cấp độ                   | Loại                 | Ví dụ                                                             | Hành vi khi FAIL                                                       |
| :----------------------- | :------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **Hard Gate**            | Block pipeline       | META-2.1 fail, BUILD-6.0 Depth Cache thiếu, Critical dangling ref | Dừng pipeline, fallback về stage gốc                                   |
| **Soft Gate**            | Warning, không block | Token budget >700, Placeholder ≥10, word_count <100               | Ghi warning vào build-log, không block                                 |
| **Graceful Degradation** | Cho phép tiếp tục    | Non-critical dangling ref (quality-matrix, domain-handbook)       | Pipeline tiếp tục ở chế độ `degraded`, agents kích hoạt defensive mode |

### 3.3 Fallback Matrix — Quality Insurance

19 fallback cases (F1-F19) + 4 phase compression cases (PC-1 đến PC-4):

**Quy tắc vàng:**

1. **Max 3 iterations per stage** — sau 3 lần fallback → escalate lên Oracle/user
2. **Append-only fallback history** — mọi rollback ghi vào `_state.yaml.fallback_history`
3. **Root cause first** — fallback về stage gần nhất trước, nếu lặp → fallback sâu hơn
4. **Context Bus preserve** — Context Bus KHÔNG reset khi fallback, chỉ append version mới

**Chain fallback điển hình:**

```text
Stage 2.5 Drift Detector phát hiện drift major
 → F8: quay Stage 1 (Architect revise design)
 → Nếu design vẫn sai → F9: quay Stage 0.5 (re-evaluate SCS)
 → Nếu SCS không đúng → quay Stage 0 (re-elicitation)
```

### 3.4 YAML Resilience Layer — Middleware bảo vệ

**Không phải gate — là interceptor** trước mọi commit YAML vào Context Bus:

| Level                  | Kiểm tra                            | FAIL →                                                        |
| :--------------------- | :---------------------------------- | :------------------------------------------------------------ |
| L1 — Syntax Lint       | `yaml.safe_load()`                  | Auto-repair subagent (max 2 attempts)                         |
| L2 — Schema Validation | Required keys + types + constraints | Auto-repair subagent (max 2 attempts)                         |
| L3 — Cross-ref Check   | Path tồn tại, file non-empty        | Critical ref → Hard Halt. Non-critical → Graceful degradation |

### 3.5 Thiết kế Gate cho LLM — Tension giữa Kiểm soát và Tự do

**Design priority hiện tại:** _"Unlock LLM power — intelligence, knowledge base, deep thinking"_

Đây là tension quan trọng:

- **Kiểm soát càng chặt** → LLM càng bị gò bó, mất sáng tạo và chiều sâu tư duy
- **Quá lỏng lẻo** → output thiếu chất lượng, sai semantic

**Cách WASHVN giải quyết:**

- Soft gates cho phép LLM không gian sáng tạo (placeholder warning, không block)
- Graceful degradation cho phép pipeline tiếp tục thay vì Hard Halt
- Binary gates chỉ block ở những điểm thực sự quan trọng (depth thinking, critical refs)
- Sampling audit thay vì 100% semantic check

---

## (4) CÁCH LLM HIỂU VẤN ĐỀ TỪ CẤU TRÚC TÀI LIỆU

### 4.1 Context Layering — 5 Layer kiến thức

LLM hiểu vấn đề qua **các lớp ngữ cảnh được xây dựng tuần tự**, mỗi lớp có responsibility riêng:

```text
L0 — Intake & Routing:     [Yêu cầu thô] → [Phân tích có cấu trúc (glossary, NFR, edge cases)]
L1 — Knowledge Foundation: [Domain-handbook với keyword triggers, anti-patterns, exemplars]
L2 — Design & Contract:    [Semantic anchors, data contracts, zone maps, quality gates]
L3 — Planning:             [Hydrated context (nén) + Thought cache (depth)] — 2 luồng song song
L4 — Implementation:       [Dual Context Ingestion → merge technical + cognitive → code]
```

**Nguyên lý quan trọng:** Mỗi layer là đầu vào cho layer sau — LLM ở layer sau không cần (và không được) đọc lại raw input từ layer trước. Điều này được đảm bảo bởi **Context Bus Rule 5**: "Ngoại trừ Context Bus, stage KHÔNG tự đọc lại upstream".

### 4.2 Context Hydration — Tiền xử lý ngữ cảnh cho LLM

**Nguyên lý đột phá nhất:** Thay vì để Planner vừa đọc domain-handbook vừa lên kế hoạch (tốn ~80% token cho đọc), **Hydrator tiền xử lý toàn bộ ngữ cảnh** thành package cô đọng.

```text
Before: Planner đọc business-analysis + domain-handbook + design + quality-matrix
        → 80% token cho đọc, 20% cho planning
After:  Hydrator đọc → hydrated-context.yaml (~30-50 dòng)
        → Planner đọc hydrated-context → 100% token cho planning
```

**Bài học cho thiết kế LLM:** Luôn pre-process context trước khi đưa cho LLM làm việc chính — giống như "context compression" nhưng có chọn lọc, không mất semantic.

### 4.3 Compression với Semantic Integrity

**Phase Compression** (Branch A) gộp 8 stages → 3 phases, giảm 62.5% LLM calls:

| Phase Gốc        | Phase Mới            | LLM-call reduction |
| :--------------- | :------------------- | :----------------: |
| S0 + S0.5 + S0.7 | D1 Discovery         |      3→1 call      |
| S1 + S1.5        | D2 Design & Contract |      2→1 call      |
| S1.7 + S2 + S2.5 | D3 Plan & Verify     |      3→1 call      |

**Nguyên lý:** Có thể nén pipeline cho task đơn giản nhưng phải đảm bảo:

- **Intermediate Diagnostic Checkpoints** vẫn được sinh ra trong output file
- **Self-applied META-criteria checklist** thay vì external gate
- Nếu fail → internal retry (max 3) trước khi escalate

### 4.4 Nguyên lý Separation of Concerns trong Document

**3 quyết định thiết kế then chốt về cấu trúc tài liệu:**

1. **Technical ≠ Cognitive**: `hydrated-context.yaml` và `thought-cache.yaml` là 2 file riêng biệt với lifecycle và consumer khác nhau.
   - Nếu gộp → cả hai đều phình to, Planner phải mang depth dù không cần
   - **Bài học:** LLM agents khác nhau cần cấu trúc tài liệu khác nhau

2. **Optional ≠ Mandatory**: Planner đọc thought-cache optional, Builder đọc mandatory.
   - **Bài học:** Cùng một tài liệu có thể là optional với agent này nhưng mandatory với agent kia

3. **Inline ≠ File reference**: Context Bus lưu hydrated_context INLINE (trong YAML) nhưng thought_cache là FILE REFERENCE.
   - Inline: cho dữ liệu nhỏ, truy cập thường xuyên
   - File ref: cho dữ liệu lớn, truy cập có chọn lọc
   - **Bài học:** Phân loại dữ liệu theo tần suất và kích thước truy cập

### 4.5 Negative Space Documentation — Dạy LLM điều KHÔNG nên làm

**Nguyên lý:** LLM hiểu vấn đề không chỉ qua "phải làm gì" mà còn qua "không được làm gì". WASHVN có cấu trúc negative space rõ ràng:

- **must_not lists** trong mọi stage (từ design đến plan đến build)
- **Anti-patterns** trong domain-handbook (Error Boundaries & Anti-Patterns)
- **Guardrails & Negative Space** là 1 trong các trách nhiệm (responsibilities) của Architect — không phải 1 trong 4 design criteria (4 criteria là: Semantic Density over Ceremony, Deterministic Data Contracts, State-Oriented Workflow, Binary Quality Gates)
- **S1 Negation Density** là 1 trong 4 Depth Signals — đo mật độ tư duy phản biện

**Ví dụ:**

```yaml
must_not:
  - 'Không log plain text OTP'
  - 'Không dùng Math.random()'
  - 'Không mock auth module'
```

> [!NOTE]
> **Bài học:** LLM cần được dạy cả "điều nên làm" VÀ "điều không nên làm" — thiếu negative space, LLM có xu hướng chọn giải pháp an toàn nhưng sai.

### 4.6 Deterministic Data Contracts — Ràng buộc hình thức cho LLM

**Nguyên lý:** Mỗi task/output phải có input_schema và output_schema xác định — giống như type system trong programming language.

**Cơ chế:**

- Mỗi task trong todo.md có back-link tới design.md §3 Zone Mapping
- Data contracts trong todo.md khớp với design.md
- State transitions trong todo.md khớp với design.md
- SSP contracts giữa micro-skills có schema matching

**Điều này giúp LLM:**

- Biết chính xác format input/output kỳ vọng
- Có thể tự kiểm tra consistency trước khi gửi đi
- Giảm ambiguous interpretation

---

## TỔNG KẾT — 7 Nguyên lý Cốt lõi

|   #   | Nguyên lý                   | Mô tả                                                           | Biểu hiện trong WASHVN                                                               |
| :---: | :-------------------------- | :-------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **1** | **Domain Anchoring**        | Neo LLM vào đúng không gian ngữ nghĩa trước khi suy luận        | Thought blocks làm mỏ neo vector; glossary 10+ terms; Dual Context Ingestion         |
| **2** | **Semantic over Ceremony**  | Nội dung đậm đặc ngữ nghĩa quan trọng hơn format cầu kỳ         | Hydrated context cô đọng; Binary gates; Data contracts xác định                      |
| **3** | **Context Pre-processing**  | Pre-process ngữ cảnh trước khi đưa cho LLM làm việc chính       | Context Hydrator tách khỏi Planner; Hydrated context ~30-50 dòng YAML                |
| **4** | **Dual Knowledge Stream**   | Technical + Cognitive là 2 luồng riêng, lifecycle riêng         | hydrated-context.yaml                                                                |     | thought-cache.yaml; Optional vs Mandatory |
| **5** | **Binary Mechanical Gates** | Gate phải nhị phân, deterministic, có thể verify bằng script    | META-2.1 v2.0: 4 signals AND; YAML Resilience 3 levels; không NLP scoring            |
| **6** | **Negative Space**          | Dạy LLM điều KHÔNG nên làm quan trọng như điều nên làm          | must_not lists, anti-patterns, guardrails, S1 Negation Density                       |
| **7** | **Graceful Degradation**    | Cho phép pipeline tiếp tục ở chế độ xuống cấp thay vì Hard Halt | Non-critical refs → degraded mode; Soft gates → warning; Sampling audit thay vì 100% |

---
