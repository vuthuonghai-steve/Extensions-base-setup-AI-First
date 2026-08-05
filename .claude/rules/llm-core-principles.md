---
trigger: always_on
description: "5 Core Cognitive Principles + Reverse Probing + quy trình giao task 5 bước cho Chrome Extension MV3 (WXT). Nguồn sự thật: Docs/Trade-offs/AGENTS.md §1-§2, Docs/Setups/Architect-workspace/Architect-workspace.md §1.3/§12. Tham chiếu bổ sung: Docs/LLMS/synthesis-llm-principles.md"
---

# 🧠 Rule: LLM Core Principles & Cognitive Scaffolding (MV3)

> **Nguồn sự thật:** `Docs/Trade-offs/AGENTS.md` (§1 Core Cognitive Principles, §2 8-Stage Pipeline) và `Docs/Setups/Architect-workspace/Architect-workspace.md` (§1.3 Reverse Probing, §11 Binary Gates, §12 quy trình giao task). Tham chiếu bổ sung: `Docs/LLMS/synthesis-llm-principles.md` (semantic activation, thought blocks).

Rule này bắt buộc áp dụng cho MỌI tương tác và nhiệm vụ sửa code trong dự án Chrome Extension MV3 (WXT). Mọi công việc phải được "neo đậu" vào không gian nghiệp vụ trước khi thực thi — cấm suy luận trong khoảng trống nhận thức (Semantic Void).

> ✅ **Trạng thái enforce:** các rule có bằng chứng cơ học đã thành hooks gate chặn ngay lúc ghi file — Negative Space (§3) và ràng buộc `traceId`/contract (§6) qua `G0-01`, `G0-02`, `G1-06`, `G1-07`, `G0-03`, `G1-08`. Các nguyên lý nhận thức (§1–§2, §4, §5) cố chủ đích **KHÔNG cơ học hóa** — hình thức enforce duy nhất là reminder PreInvocation (`G1-05`). Phần còn lại đánh dấu ⚠️ vẫn là rule mềm. Chi tiết: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.

## 1. Năm Nguyên lý Tư duy Cốt lõi (5 Core Cognitive Principles)

### 1.1 Domain Anchoring
Toàn bộ ngữ cảnh (người và AI) phải được neo vào không gian vấn đề — glossary, stakeholder map, danh sách edge case — **TRƯỚC khi viết code**. Với MV3, không gian vấn đề là ma trận Execution Context (SW, Content Isolated/Main World, Popup, Offscreen) và các ràng buộc vật lý của nền tảng.
**Công nghệ là OUTPUT của ràng buộc nghiệp vụ, không phải INPUT.** Mọi lựa chọn kiến trúc (layer, adapter, storage, test runner) phải liên kết được tới một ràng buộc cụ thể.
> ✅ Cấu trúc Domain Anchor Doc (glossary, stakeholder, persona, edge case) được kiểm cơ học bởi **G1-03** `gate_doc_structure.py`.

### 1.2 Dual Context Ingestion
Đồng thời nạp 2 luồng thông tin song song trước khi làm:
- **Technical Scaffolding** = "phải code gì": contract IPC/storage schema trong `0_contracts/` (ipc-actions, ipc-payloads, storage-schema, domain-entities).
- **Cognitive Depth** = "vì sao code như vậy": business intent, lý do nghiệp vụ, thought blocks — không được nén mất chiều sâu này.

### 1.3 Thought Latency (4 Depth Signals)
Chững lại, phân tích đa chiều **TRƯỚC** khi đưa giải pháp, qua đủ 4 tín hiệu:
- `S1_negation_density`: xác định negative space — điều hệ thống KHÔNG ĐƯỢC LÀM và hậu quả (mục 3).
- `S2_reverse_question`: Reverse Probing — "Điều gì sẽ khiến giải pháp này thất bại? Điểm lỗi là gì?" (mục 4).
- `S3_multi_stakeholder`: phân tích tác động lên người dùng cuối, lập trình viên, doanh nghiệp, Chrome Web Store (gatekeeper).
- `S4_constraint_anchoring`: neo chặt vào ràng buộc vật lý MV3 (SW kill, CSP, bundle public, CORS từng context).

### 1.4 Binary Quality Gates
Mọi cổng kiểm soát chất lượng là **Pass/Fail** dựa trên kiểm chứng cơ học (typecheck, test, ESLint/CI, Binary Gates §11 Architect-workspace) — tuyệt đối không chấm điểm chủ quan, không tin báo cáo "đã xong" mà không verify.

### 1.5 Graceful Degradation
Khi một dịch vụ/dependency lỗi, hệ thống **hạ cấp hoạt động êm ái** thay vì crash toàn cục. MV3: SW bị kill → state externalize ra `chrome.storage`; storage locked, network timeout, quota vượt ngưỡng → kích hoạt fallback mode có văn bản + mã nguồn, không lỗi toàn app.

## 2. Implicit Scoping & Zero-Artifact Lean Execution
- **Zero-Artifact:** tự phân rã bài toán trong tư duy; KHÔNG tự ý tạo file kế hoạch/báo cáo rác (`implementation_plan.md`, report files) gây ô nhiễm workspace và lãng phí context suy luận.
- **Quality Over Speed:** ưu tiên độ chuẩn xác, kiến trúc mô-đun, tính ổn định hơn vội vã trả lời 1-shot.
- **SRP / chống monolithic:** tự tách file mới khi file bắt đầu ôm đồm nhiều trách nhiệm (Single Responsibility Principle); CẤM file monolithic nhét chung UI + Logic + Storage.
- **Mechanical Verification:** mọi sửa code phải pass 100% nhị phân: `npm run typecheck` + `npm run test` + Binary Gates §11 (OBS-1..ARC-2). Lỗi → tự phân tích log traceback, Self-Correction Loop trước khi hoàn tất.

> ℹ️ **Giữ nguyên (kiến thức nhận thức):** các nguyên lý §1–§2 (Domain Anchoring, Dual Context, Thought Latency, Graceful Degradation, Zero-Artifact...) là hành vi tư duy — KHÔNG cơ học hóa được (không script nào "chấm điểm suy nghĩ"); hình thức enforce duy nhất là reminder PreInvocation **G1-05** `remind_domain_anchor.py`. Riêng ràng buộc cấu trúc tài liệu trong §1.1 đã có hook (✅ ở trên).

## 3. Negative Space — must_not + consequence_of_violation
Vi phạm bất kỳ mục nào là chấp nhận hậu quả kèm theo:

| # | must_not | consequence_of_violation | Enforce |
|---|---|---|---|
| 1 | Giữ business state trong memory Service Worker | SW bị Chrome kill sau ~30s idle → **mất state âm thầm**; DevTools mở giữ SW sống nhân tạo → bug không tái hiện, che giấu lỗi. State phải externalize `chrome.storage` | ⚠️ Còn soft — review |
| 2 | Nhầm Isolated World thấy biến JS trang (`window.__NEXT_DATA__`...) | **Isolated World không share JS runtime** với trang, chỉ share DOM node → code đọc undefined, fail âm thầm | ⚠️ Còn soft — kiến thức |
| 3 | Import `chrome.*` vào `3_modules/` | Module **vĩnh viễn không unit-test được**, không tái dùng giữa các context | ✅ **G1-06** (chrome_regex/dom_regex) |
| 4 | Dùng `innerHTML` chèn `<script>` / `eval()` | **CSP MV3 chặn cứng**; extension bị Chrome Web Store **từ chối duyệt** | ⚠️ Còn soft — CSP + review |
| 5 | `postMessage` rải rác giữa Isolated ↔ Main World | Vỡ contract luồng message; phải chỉ đi qua `main-world-bridge.ts` duy nhất | ✅ **G1-06** (post_message_regex + bridge_file) |
| 6 | `console.log` trần trong `src/` (trừ `telemetry/logger.ts`) | Vi phạm **OBS-1**; log phân mảnh 3+ process, SW kill làm mất log | ✅ **G1-06** (console_log_regex) + ESLint |
| 7 | Giữ business state trong Popup (React state) | Vi phạm **ADR-007**; Popup chết ngay khi mất focus → mất dữ liệu. Popup chỉ là view, state thật nằm storage | ⚠️ Còn soft — review |
| 8 | Tạo file kế hoạch rác / Zero Placeholder (TODO, mock data, fake response) | Vi phạm **BQD-2**; chạy thử đẹp nhưng sập khi chạy thật, ô nhiễm workspace | ✅ **G0-01** `gate_placeholder_pre.py` + **G0-02** `gate_placeholder_stop.py` |
| 9 | Hardcode secret / API key bên thứ 3 vào code | Vi phạm **CFG-1**; bundle luôn public, ai cũng unpack đọc plaintext → key phải ở Backend Proxy | ✅ **G1-08** `gate_secret_scan.py` (backstop, scan `dist/` sau build) + ⚠️ CI |
| 10 | Nhét business logic vào `1_engine/` | Engine phải chỉ Register & Listen; logic phức tạp nằm `3_modules/` (pure TS, test được) | ⚠️ Còn soft — không hook, kiến thức |

> 📌 Regex/đường dẫn chính xác nằm ở `.agent/hooks/scripts/config/rules.yaml` (sections: `placeholder`, `arch_boundary`, `secret`); danh sách gate đầy đủ tại `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md` (§2 — G0-01, G0-02, G1-06, G1-08).

## 4. Reverse Probing — 5 nguyên nhân thất bại MV3
Trước mọi giải pháp, hỏi ngược: "Điều gì sẽ khiến giải pháp này thất bại?" — 5 nguyên nhân phải luôn trong tầm kiểm soát:

1. Giả định biến toàn cục trong Background sống mãi → SW bị kill giữa chừng → **mất state âm thầm**; DevTools mở giữ SW sống nhân tạo → **che giấu bug khi debug**.
2. Nhầm Content Script đọc được biến JS trang → **Isolated World không share JS runtime** với trang, chỉ share DOM node.
3. Import `chrome.*` thẳng vào logic nghiệp vụ → module **vĩnh viễn không unit-test được**, không tái dùng giữa các context.
4. Dùng `innerHTML` chèn `<script>` / `eval()` → **CSP MV3 chặn cứng** + Chrome Web Store **từ chối duyệt**.
5. Message passing không timeout/retry → khi SW "ngủ", **message đầu bị mất**, fail âm thầm không throw lỗi rõ ràng.

> ℹ️ **Giữ nguyên:** Reverse Probing là hành vi tư duy, không có bằng chứng cơ học — chỉ reminder (`G1-05`), không có hook chặn.

## 5. Câu hỏi bắt buộc trước khi code
Trước MỌI đoạn code, Agent phải trả lời rõ (người duyệt câu trả lời trước khi cho chạy):

> "Đoạn code này chạy trong context nào? Nó cần `chrome.*` API gì? Nếu Service Worker bị kill giữa lúc xử lý, hệ quả là gì và có mất dữ liệu không?"

**Không trả lời rõ ràng → DỪNG LẠI, yêu cầu làm rõ trước khi tiếp tục** — đó là tín hiệu code sẽ sai layer/context.

> ℹ️ **Giữ nguyên:** câu hỏi bắt buộc là tín hiệu nhận thức — không cơ học hóa.

## 6. Quy trình giao task 5 bước (Dual Context)
Mỗi task đi theo đúng 5 bước:
1. **Contract IPC trước** — Request/Response type cho `feature:action-name` trong `0_contracts/ipc-payloads.ts`, field `traceId` BẮT BUỘC (type-level, không optional). ✅ **G1-07** `gate_traceid.py` (PostToolUse backstop) + **G0-03** `gate_contract_lock.py` (force_ask khi sửa `0_contracts/`).
2. **Sub-module & Core Logic** — Sub-module thuần TS trong `3_modules/` (100% Pure TS, không `chrome`/`document`/`window`) kèm Unit Test Vitest. ✅ Ràng buộc pure TS được chặn bởi **G1-06** (chrome_regex/dom_regex).
3. **Platform Adapter** — Adapter trong `2_platform_adapters/` bọc `chrome.*` 1-1 (storage, tabs, ipc sender timeout + retry...).
4. **Engine Background** — Đăng ký handler trong `1_engine/background/listeners/message-listener.ts`, route qua IPC Router tới Composite Module.
5. **UI/Inject** — Mount Point Shadow DOM để inject UI vào trang đích (cô lập CSS, tránh trang đích phá giao diện).

> ℹ️ Các bước 3–5 (Platform Adapter, Engine Background, UI/Inject) là kiến thức quy trình — không có hook.

## 7. Quy tắc chrome.* theo Layer
- Chỉ được import trực tiếp `chrome.*` trong **`1_engine/`** và **`2_platform_adapters/`** (adapter bọc 1-1). ℹ️ Kiến thức kiến trúc.
- **CẤM tuyệt đối** ở `0_contracts/`, `3_modules/`, `4_presentation/` — các tầng này chỉ qua Adapter/IPC. ✅ Riêng `3_modules/` đã chặn bởi **G1-06** (chrome_regex/dom_regex); `0_contracts/` + `4_presentation/` ⚠️ còn soft.
- Enforce bằng lint/CI (ARC-1: không import ngược chiều, ARC-2: `3_modules/` không import chrome/document/window), không phải tự giác. ✅ Đã thăng cấp thành hook **G1-06** `gate_arch_boundary.py` (deny ngay lúc ghi file) + dependency-cruiser/ESLint (CI).
- Giao tiếp Isolated World ↔ Main World chỉ qua `main-world-bridge.ts`. ✅ **G1-06** (post_message_regex + bridge_file).

## 8. Bối cảnh vận hành: 8-Stage Pipeline
Các nguyên lý trên vận hành trong pipeline 8 giai đoạn: 1 Discovery & Domain Anchoring → 2 Scope & Dual Context Spec → 3 Architecture & Tech Selection → 4 MVP Viability Gate → 5 Build & Quality → 6 Real-World Validation → 7 Commercialization Bridge → 8 Launch & Operate. Mỗi stage có Binary Gate riêng; khi fail → Root Cause First: tìm nguyên nhân gốc, quay về giai đoạn gần nhất trước khi sửa.

> ℹ️ **Giữ nguyên:** pipeline 8 giai đoạn là kiến thức quy trình vận hành — các gate kèm theo đã đánh dấu ✅/⚠️ tại `code-quality-and-gates.md` và `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.
