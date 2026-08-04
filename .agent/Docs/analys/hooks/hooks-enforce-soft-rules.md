# Phân tích: Chuyển Rule Mềm → Rule Nghiêm Ngặt bằng Hooks (Python/Shell)

> **Ngày:** 2026-08-05
> **Phạm vi:** AGENTS.md (Docs/Trade-offs) + architecture-and-flow.md (.agent/rules)
> **Căn cứ kỹ thuật:** hooks-standardized.md (.agent/Knowlades) — Antigravity IDE Hooks
> **Mục đích:** Xác định rule mềm nào nên được cơ học hóa thành rule nghiêm ngặt (chặn bằng code) dựa trên năng lực hook events.

---

## 1. Nhận định tổng quan

- **~60% rule mềm trong AGENTS.md thuộc dạng "tự khai báo, tự kiểm"** — AI viết doc rồi tự đánh giá PASS. Đây chính là điểm yếu mà hooks có thể bịt:
  - `PreToolUse` đọc được **nội dung file sắp ghi** (`CodeContent`), đường dẫn (`TargetFile`), lệnh sắp chạy (`CommandLine`) → chặn ngay lập tức.
  - `Stop` ép được Agent **không được dừng** khi tiêu chí chưa đạt (`decision: "continue"`).
  - `PreInvocation` chèn reminder transient (`ephemeralMessage`) mỗi lượt gọi model.
- **Không phải rule nào cũng nên cơ học hóa.** Rule về nhận thức (Thought Latency, Reverse Probing), phán đoán con người (GO/PIVOT/KILL), tính xác thực của phỏng vấn → cơ học hóa giả tạo sinh "fake compliance" (viết doc đối phó script).
- **`architecture-and-flow.md` là nguồn vàng bổ trợ**: các rule import boundary, console.log, traceId đã tuyên bố "enforce bằng lint/CI" — hooks đóng vai trò **backstop tức thì** (chặn ngay lúc ghi file, thay vì chờ CI phát hiện sau).

---

## 2. Ma trận năng lực hooks → khả năng enforce

| Năng lực hook                                                             | Loại rule chặn được                                                                                                   | Độ mạnh                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `PreToolUse` + đọc `toolCall.args` (TargetFile, CodeContent, CommandLine) | Chặn **ngay trước khi viết code/ghi file/chạy lệnh** — scan nội dung code sắp ghi (TODO, console.log, import vi phạm) | 🔥 Mạnh nhất — `deny`/`force_ask`               |
| `Stop` + `decision: "continue"`                                           | Cổng cuối: không cho Agent kết thúc khi test fail / còn placeholder / thiếu bằng chứng                                | 🔥 Mạnh — chống "AI báo xong nhưng chưa verify" |
| `PreInvocation` + `injectSteps`                                           | Nhắc neo ngữ nghĩa mỗi lượt gọi model (đọc Domain Anchor Doc, 4 Depth Signals)                                        | 💡 Yếu, chỉ reminder                            |
| `PostToolUse`                                                             | Chạy scan/lint/log sau mỗi lần ghi file — **không chặn được**, chỉ phát hiện                                          | 💡 Trung bình                                   |
| `PostInvocation` + `force_continue`/`terminate`                           | Ép tiếp tục/dừng sau mỗi lượt tool call                                                                               | 💡 Trung bình                                   |

**Nguyên tắc chọn**: rule nào có "bằng chứng cơ học" (nội dung file, cấu trúc doc, lệnh shell) → cơ học hóa được. Rule nào chỉ có "ý định/nhận thức" → không.

---

## 3. Bảng chuyển đổi chi tiết (rule mềm → hook cụ thể)

### 🥇 P0 — Chuyển ngay, tự động 100%, ROI cao nhất

| #    | Rule mềm (AGENTS.md)                                                                       | Cơ chế hook                                                                                 | Script kiểm tra                                                                                                                                | Kết quả khi vi phạm                                                  |
| ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P0-1 | **BQD-2 / Stage 5: Zero Placeholder** — "không TODO, mock data, lorem ipsum ở luồng chính" | `PreToolUse` matcher `write_to_file\|replace_file_content\|multi_replace_file_content`      | Scan `CodeContent`/`ReplacementChunks` bằng regex `TODO\|FIXME\|XXX\|lorem ipsum\|mock data\|placeholder`                                      | `deny` + reason liệt kê dòng vi phạm                                 |
| P0-2 | BQD-2 (lớp 2): full-repo scan trước khi dừng                                               | `Stop` → nếu scan thấy placeholder → `continue`                                             | `grep -rE` trên `src/`, bỏ qua test fixtures                                                                                                   | `continue` + reason "còn N placeholder"                              |
| P0-3 | **DES-2 / Stage 5 must_not: AI tự đổi data contract**                                      | `PreToolUse` matcher file-edit, check `TargetFile` khớp `0_contracts/`                      | Script chỉ cần đúng 1 điều kiện đường dẫn                                                                                                      | `force_ask` — **bắt buộc hỏi người**, bỏ qua Always Allow            |
| P0-4 | **Stage 4: Không code trước khi GO doc được ký duyệt** (Human-only)                        | `PreToolUse` matcher file-edit, `TargetFile` nằm trong code paths (`src/`, `3_modules/`...) | Check file `docs/decisions/viability-gate.md` tồn tại + chứa `GO`                                                                              | `deny` + reason "MVP Viability Gate chưa PASS, không được viết code" |
| P0-5 | **Stage 5: Không bypass test/lint**                                                        | `PreToolUse` matcher `run_command`                                                          | Regex chặn: `--no-verify`, `--skip-`, `\[skip ci\]`, `describe.only`, `it.only`, `test.skip`                                                   | `deny`                                                               |
| P0-6 | **Stage 5 must_not: Không tin báo cáo "đã xong" của AI**                                   | `Stop`                                                                                      | Script đọc `transcriptPath` (có sẵn trong input): nếu lượt cuối có file-edit mà **không có** `run_command` chứa test/lint sau đó → chưa verify | `continue` + reason "code vừa sửa chưa chạy test"                    |

> ⚠️ **P0-6** cần parse `transcript.jsonl` — phức tạp hơn nhưng là mẫu "Stop Loop Re-entry" chuẩn trong tài liệu hooks, hoàn toàn khả thi.

### 🥈 P1 — Chuyển ở mức "cổng tài liệu" (document-gate), script đơn giản

| #    | Rule mềm                                                                | Cơ chế hook                                                        | Script kiểm tra                                                                                       | Kết quả                                                      |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P1-1 | **DES-1 / Stage 2: Negative Space ≥ 5 mục**                             | `Stop` hoặc `PostInvocation` khi Agent báo "xong Stage 2"          | Parse file Negative Space: đếm bullet ≥ 5, mỗi mục có "hậu quả"                                       | `continue` nếu thiếu                                         |
| P1-2 | **Stage 2: Must-have ≤ 5**                                              | Như trên                                                           | Đếm item gắn nhãn `Must-have` trong MoSCoW                                                            | `continue` nếu > 5                                           |
| P1-3 | **VAL-3 / Stage 1: Domain Anchor Doc đủ cấu trúc**                      | `Stop` khi kết thúc Stage 1                                        | Kiểm tra doc chứa: glossary ≥ 10 thuật ngữ, ≥ 3-5 persona, ≥ 5 failure reasons, edge cases            | `continue` + reason liệt kê thiếu mục nào                    |
| P1-4 | **DES-3: ADR tồn tại cho quyết định công nghệ**                         | `Stop`                                                             | Check thư mục ADR có file, mỗi file chứa phần "Constraints"                                           | `continue` nếu trống                                         |
| P1-5 | **Stage 5: Re-feed Domain Anchor Doc mỗi phiên**                        | `PreInvocation` (không matcher)                                    | Script đọc file anchor (nếu tồn tại) → trả `injectSteps: [ephemeralMessage]` chứa tóm tắt + đường dẫn | Reminder transient trước mỗi lượt model                      |
| P1-6 | **architecture-and-flow: cấm `console.log` trần / import vi phạm tầng** | `PreToolUse` matcher file-edit, `TargetFile` trong `3_modules/`    | Scan CodeContent: regex `chrome\.` hoặc `from ['"].*1_engine/\|2_platform_adapters/`                  | `deny` — bổ trợ ESLint, chặn sớm hơn CI                      |
| P1-7 | **architecture-and-flow: `traceId` bắt buộc**                           | `PostToolUse` matcher file-edit trên `0_contracts/ipc-payloads.ts` | Scan file sau khi sửa: field `traceId` không optional                                                 | Chạy như backstop (không chặn, ghi log — type checker đã lo) |

### 🥉 P2 — Enforce dựa trên "bằng chứng artifact" (một phần)

| #    | Rule mềm                                                      | Cơ chế                                                                       | Ghi chú                                                                  |
| ---- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| P2-1 | **Stage 5: Chạy thử staging/production, không chỉ localhost** | `Stop` → check transcript có deploy/staging evidence (URL, log deploy)       | Khó fake-proof, chỉ chặn được trường hợp "chưa có bất kỳ bằng chứng nào" |
| P2-2 | **Stage 6: Usability report ≥ 80% hoàn thành core flow**      | `Stop` trước khi sang Stage 7 → parse `validation-report.md` có metric ≥ 80% | Chỉ check sự tồn tại + con số, không verify tính thật                    |
| P2-3 | **Stage 8: Alerting ≥ 3 chỉ số**                              | `Stop` → scan codebase có cấu hình monitoring (sentry, alert config)         | Check config tồn tại                                                     |
| P2-4 | **Stage 7: ToS/Privacy có dấu "human reviewed"**              | `Stop` → check checklist doc có flag phê duyệt                               | Con người phải tự đảm bảo — script chỉ chặn thiếu sót hành chính         |

---

## 4. Không nên chuyển đổi (giữ soft) — kèm lý do

| Rule                                                                                      | Lý do không cơ học hóa                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Core Cognitive Principles** (Domain Anchoring, Thought Latency 4 signals, Dual Context) | Nhận thức không có bằng chứng cơ học — script không thể "chấm điểm suy nghĩ". Chỉ dùng `PreInvocation` reminder                |
| **Stage 1: Phỏng vấn ≥ 5 người thật, không bạn bè/gia đình**                              | Tính xác thực của con người không verify được bằng script. Script chỉ check doc tồn tại (P1) — đừng giả vờ kiểm được nhiều hơn |
| **Stage 4: Quyết định GO/PIVOT/KILL là Human-only**                                       | Đúng điểm — nhưng chuyển thành **"chặn code trước khi có GO doc"** (P0-4). Chặn hệ quả, không thay thế quyết định              |
| **Stage 6: Phát hiện Semantic Drift**                                                     | Bản chất định tính, cần con người đối chiếu                                                                                    |
| **Stage 7: Onboarding ≤ 5 phút, ≤ 5 bước**                                                | Cần đo lường UX thực tế, không phải check tĩnh                                                                                 |
| **Reverse Probing khi viết code**                                                         | Hành vi tư duy — chỉ reminder                                                                                                  |

> ⚠️ **Cảnh báo Goodhart**: nếu script đếm "doc có 5 bullet Negative Space" thì AI sẽ viết 5 bullet rỗng nghĩa để qua gate. Với rule P1/P2, script chỉ nên **chặn thiếu sót hành chính**, đừng biến thành mục tiêu tối ưu — chất lượng thật vẫn thuộc về review con người.

---

## 5. Rủi ro kỹ thuật khi hiện thực (từ chính tài liệu hooks)

1. **Matcher sai tên tool = hook chết lặng** — phải verify tên tool đúng: `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `run_command`. Validate bằng bảng check mục (11) của hooks-standardized.
2. **Field args khác nhau giữa tool**: nội dung cần scan nằm ở `CodeContent` (write_to_file) nhưng `ReplacementChunks` (multi_replace_file_content) — script phải xử lý cả 2 shape.
3. **stdout phải là JSON hợp lệ + `decision` bắt buộc** cho `PreToolUse`/`Stop` — thiếu field = engine xử lý mặc định (có thể thành deny mặc định gây nghẽn toàn bộ luồng).
4. **Timeout**: scan full-repo trong `Stop`/`PostToolUse` có thể > 30s default — set `timeout` cao hơn hoặc scan incremental (chỉ file vừa sửa).
5. **Over-blocking**: deny quá nhiều → Agent không làm được việc. Ưu tiên `deny` chỉ cho rule P0 rõ ràng; còn lại dùng `force_ask` để giữ con người trong vòng lặp.
6. **Graceful degradation**: hook fail không được chặn pipeline — script phải exit 0 với `{"decision":"allow"}` khi gặp lỗi không xác định (fail-open), trừ các rule bảo mật/contract (fail-closed).

---

## 6. Đề xuất kiến trúc scripts

```
.agents/scripts/hooks/
├── gate-placeholder.py        # P0-1/P0-2: scan content → deny; Stop → continue
├── gate-contract-lock.py      # P0-3: TargetFile ∈ 0_contracts/ → force_ask
├── gate-viability.py          # P0-4: code path mà thiếu GO doc → deny
├── gate-test-bypass.py        # P0-5: regex lệnh bypass → deny
├── gate-stop-verify.py        # P0-6: Stop → test/scan còn lỗi → continue
├── gate-doc-structure.py      # P1-1..4: Negative Space, MoSCoW, Domain Anchor, ADR
├── remind-domain-anchor.py    # P1-5: PreInvocation → ephemeralMessage
├── gate-arch-boundary.py      # P1-6/P1-7: console.log, import tầng, traceId
└── gate-evidence.py           # P2: report/staging/alerting artifacts
```

Mỗi script theo cùng contract: **đọc JSON từ stdin → trả `{"decision": ..., "reason": ...}` ra stdout** — đúng chuẩn hooks, dễ test độc lập bằng input mẫu (bảng validation mục 11 trong tài liệu hooks).

### Mẫu input/output contract

```bash
# Input (stdin) — PreToolUse
echo '{"toolCall": {"name": "write_to_file", "args": {"TargetFile": "src/3_modules/a.ts", "CodeContent": "// TODO: fix later"}}, "stepIdx": 3, "conversationId": "uuid", "workspacePaths": ["/workspace"]}' \
  | python3 .agents/scripts/hooks/gate-placeholder.py

# Output (stdout)
{"decision": "deny", "reason": "BLOCKED: TODO placeholder tại dòng 1 (a.ts). Zero Placeholder policy — BQD-2."}
```

---

## 7. Kết luận & Lộ trình

### Triển khai ngay (P0 — 6 script)

1. **Zero Placeholder** (2 lớp: PreToolUse scan + Stop full-repo) — chặn rule mềm nguy hiểm nhất khi AI tự đánh giá.
2. **Contract Lock** — `0_contracts/` chỉ sửa qua `force_ask` (con người duyệt).
3. **Viability Gate trước code** — không GO doc = không được viết code.
4. **Chặn bypass test/lint** — `--no-verify`, `.only`, `test.skip`.
5. **Stop-verify** — chống "AI báo xong nhưng chưa chạy test".

### Triển khai sau (P1 — 5 script)

Cổng cấu trúc tài liệu (Negative Space, MoSCoW, Domain Anchor, ADR) + reminder neo ngữ nghĩa + backstop kiến trúc (console.log, import tầng).

### P2 (chỉ khi P0/P1 ổn định)

Enforce bằng chứng artifact: staging/deploy, usability report, alerting config, ToS review.

### Giữ nguyên soft

Nhận thức, tính xác thực con người, đánh giá định tính — kèm guard chống fake compliance (Goodhart).

---

_Tài liệu dựa trên: AGENTS.md (8-Stage Pipeline, Assurance Checklist), hooks-standardized.md (Antigravity IDE Hooks — Google), architecture-and-flow.md (Chrome Extension MV3/WXT)._
