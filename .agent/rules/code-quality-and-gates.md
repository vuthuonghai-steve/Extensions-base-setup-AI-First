---
trigger: model_decision
description: "ghiệm thu Chrome Extension MV3 (WXT): 9 gate chính thức (§11 Architect-workspace) + 7 gate bổ sung đề xuất (AGENTS.md Assurance Checklist), quy ước type safety tầng 3_modules/2_platform_adapters, Negative Space kèm consequence_of_violation"
---

# Rule: Code Quality & Binary Gates (MV3 / WXT)

Rule này là xương sống nghiệm thu của dự án Chrome Extension MV3 (WXT). Mọi gate đều **nhị phân (Pass/Fail)**, kiểm chứng cơ học bằng hooks + CI/test thật — không chấm điểm chủ quan, không bypass "tạm thời" để merge.

> ✅ **Trạng thái enforce:** các gate ranh giới (ARC-1/2/3, OBS-1, TYP-1), placeholder (ZPL-1), secret (CFG-1/1+), traceId (OBS-2) và contract lock đã được cơ học hóa thành hooks gate (`G0-01`…`G1-08`) — chặn ngay lúc ghi file (PreToolUse/Stop/PostToolUse), không còn là rule "tự khai báo, tự kiểm". Các gate còn lại đánh dấu ⚠️ vẫn là rule mềm, lớp chặn là CI. Chi tiết config: `.agent/hooks/scripts/config/rules.yaml`; danh sách gate đầy đủ: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.

**Nguồn:** chính — `Docs/Setups/Architect-workspace/Architect-workspace.md` §11 (Binary Gate checklist), §9 (quy tắc phụ thuộc), §6.2 (traceId/console.log); bổ sung — `Docs/Trade-offs/AGENTS.md` §1 (Binary Quality Gates) + Assurance Checklist BQD-1..4.

## 1. Binary Gates chính thức (§11 — bắt buộc pass trước merge)

| Gate ID | Nội dung | Cơ chế enforce | Trạng thái |
|---|---|---|---|
| **OBS-1** | Không có `console.log` trần ngoài `telemetry/logger.ts` | 🔥 Hook **G1-06** `gate_arch_boundary.py` (console_log_regex, logger_file) + ESLint (CI) | ✅ Cơ học hóa |
| **OBS-2** | Mọi IPC message mang `traceId` (field bắt buộc, không optional) | 🔥 Hook **G1-07** `gate_traceid.py` (PostToolUse backstop, lọc `traceId?` trong `0_contracts/ipc-payloads.ts`) + **G0-03** `gate_contract_lock.py` (force_ask khi sửa `0_contracts/`) + type-level build fail | ✅ Cơ học hóa |
| **OBS-3** | Debug Console Page export log JSON hoạt động | Playwright test verify log xuất hiện đúng `traceId` (CI) | ⚠️ Còn soft (CI) |
| **CFG-1** | Không có API key bên thứ 3 trong `dist/` sau build | 🔥 Hook **G1-08** `gate_secret_scan.py` (PostToolUse backstop sau lệnh build) + CI scan | ✅ Cơ học hóa |
| **CFG-1+** | Mở rộng secret scan (`-----BEGIN`, `ghp_`, `sk-ant-`...) | 🔥 Hook **G1-08** — patterns mở rộng đã nằm trong rules.yaml `secret.patterns` | ✅ Cơ học hóa |
| **CFG-2** | Build fail cứng khi thiếu biến `.env` bắt buộc | CI — `config-schema.ts` (Zod) validate lúc build | ⚠️ Còn soft (CI) |
| **TST-1** | Mỗi use-case trong composite-modules có Vitest coverage | CI — coverage report trên `3_modules/` | ⚠️ Còn soft (CI) |
| **TST-2** | Mỗi core flow có ≥1 Playwright E2E chạy trên extension build thật | CI — load unpacked extension (`--load-extension`), chạy flow | ⚠️ Còn soft (CI) |
| **ARC-1** | Không có import ngược chiều (Layer thấp import Layer cao) | 🔥 Hook **G1-06** `gate_arch_boundary.py` (forbidden_imports: `1_engine/`, `3_modules/`) + dependency-cruiser (CI) | ✅ Cơ học hóa |
| **ARC-2** | `3_modules/` không import `chrome`/`document`/`window` | 🔥 Hook **G1-06** (chrome_regex, dom_regex áp dụng khi TargetFile chứa `3_modules/`) + static scan | ✅ Cơ học hóa |

## 2. Gate bổ sung đề xuất

**Đề xuất bổ sung từ AGENTS.md Assurance Checklist** — chưa nằm trong §11. Một số đã được thăng cấp thành hooks gate (✅) và chặn ngay lúc ghi file; phần còn lại chạy ở mức warning cho tới khi được duyệt.

| Gate ID | Nội dung | Cơ chế enforce | Trạng thái |
|---|---|---|---|
| **BASE-0** | Typecheck + lint 0 lỗi trước mọi gate | CI — `npm run typecheck` + lint chạy đầu pipeline, fail nhanh | ⚠️ Còn soft (CI) |
| **ZPL-1** | Zero Placeholder: scan `TODO`/`FIXME`/mock data/`lorem ipsum` trong `src/` (trừ tests fixtures) | 🔥 Hook **G0-01** `gate_placeholder_pre.py` (PreToolUse scan từng file ghi) + **G0-02** `gate_placeholder_stop.py` (Stop full-repo scan) | ✅ Cơ học hóa |
| **GRD-1** | Graceful Degradation: ≥2 kịch bản mock adapter fail → luồng chính không crash | Vitest/Playwright (CI). G2-03 `gate_evidence.py` chỉ cover alerting config (sentry/alert...), chưa cover degradation tests | ⚠️ Còn soft (CI) |
| **TYP-1** | Cấm `as any` / `@ts-ignore` / `@ts-expect-error` | 🔥 Hook **G1-06** (ts_ignore patterns) + ESLint (CI) | ✅ Cơ học hóa |
| **ARC-3** | Isolated ↔ Main World chỉ qua `main-world-bridge.ts`, chặn `postMessage` trần | 🔥 Hook **G1-06** (post_message_regex + bridge_file) | ✅ Cơ học hóa |
| **NEG-1** | Mọi `must_not` kèm `consequence_of_violation` | 🔥 Một phần **G1-01** `gate_doc_structure.py` (đếm ≥ 5 mục + keyword consequence trên `docs/negative-space.md`); chất lượng nội dung vẫn là review thủ công | ✅ Một phần |

> 📌 Regex/đường dẫn/ngưỡng chính xác nằm ở `.agent/hooks/scripts/config/rules.yaml` (sections: `placeholder`, `contract_lock`, `viability`, `test_bypass`, `arch_boundary`, `doc_structure`, `evidence`, `traceid`, `secret`); danh sách gate đầy đủ (event, matcher, script, quyết định) tại `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md` (§2 — G0-01..G2-04).

## 3. Quy ước code (CONVENTION — không phải gate cơ học)

- **`Result<T, E>` là convention nội bộ tầng `3_modules/` + `2_platform_adapters/`**: mọi hàm có khả năng thất bại trả `Ok<T>` hoặc `Err<E>`. Không bắt buộc ở Layer 1/4 (entrypoint/UI) — đây là quy ước, không phải gate cơ học.
- **Discriminated Union** cho mọi IPC message, tập trung tại `0_contracts/ipc-actions.ts` (enum action) + `0_contracts/ipc-payloads.ts` (Request/Response kèm `traceId` bắt buộc) — nguồn sự thật duy nhất cho type xuyên process.
- **Cấm silent catch**: mọi `catch` phải log qua `telemetry/logger.ts` **hoặc** trả `Result.err` — không được nuốt ngoại lệ im lặng.
- **Không trả `undefined`/`null` mập mờ** thay cho kết quả xử lý lỗi — dùng `Result.err` tường minh.
- Logger: chỉ `telemetry/logger.ts` được gọi `console.*` (ghi đồng thời console context gốc + Log Sink IPC theo §6.2).

Ghi chú enforce: silent catch và `undefined`/`null` mập mờ **không có** hook (kiến thức, review thủ công); hạn chế `console.*` ngoài `telemetry/logger.ts` đã nằm trong gate OBS-1 (**G1-06**); `traceId` bắt buộc đã nằm trong gate OBS-2 (**G1-07** + type-level).

## 4. Negative Space (`must_not` + hậu quả)

Chuẩn theo AGENTS.md: mỗi `must_not` phải ghi `consequence_of_violation` (gate NEG-1 — phần cấu trúc doc đã có hook **G1-01**). Tối thiểu các mục phù hợp MV3:

| `must_not` | `consequence_of_violation` | Enforce |
|---|---|---|
| Giữ business state trong React state của Popup | Popup chết ngay khi mất focus → mất dữ liệu không cứu được (ADR-007) | ⚠️ Không hook — review |
| Nhét secret/API key bên thứ 3 vào `.env` build | Bundle luôn public, ai cũng unpack đọc plaintext → phát key miễn phí cho mọi người dùng (§6.3) | ✅ **G1-08** `gate_secret_scan.py` (scan `dist/` sau build) |
| Dùng `innerHTML` chèn `<script>` / `eval()` | CSP MV3 chặn cứng, Chrome Web Store từ chối duyệt (§1.3) | ⚠️ Không hook — CSP + review |
| Import `chrome.*` vào `3_modules/` | Module vĩnh viễn không unit-test được, không tái dùng xuyên context (§1.3) | ✅ **G1-06** (chrome_regex + dom_regex) |
| Bỏ qua `traceId` khi gửi IPC message | Không ghép được log rời rạc 3+ process thành 1 chuỗi nhân-quả để debug (§6.1) | ✅ **G1-07** (PostToolUse backstop) + type-level |
| `postMessage` trần giữa Isolated ↔ Main World | Vỡ contract giao tiếp, không kiểm soát được luồng message (§9) | ✅ **G1-06** (post_message_regex + bridge_file) |
| Dựa memory Service Worker giữ state | SW bị Chrome random kill sau ~30s idle → mất state âm thầm, bug không tái hiện được (§1.3) | ⚠️ Không hook — review |
| `console.log` trần ngoài `logger.ts` | Log phân mảnh theo process, mất khi SW kill, không có traceId nối chuỗi (§6.2) | ✅ **G1-06** (console_log_regex) + ESLint |

Ngoài bảng trên, các `must_not` Stage process (AGENTS.md) cũng đã có hook: sửa `0_contracts/` không hỏi người → **G0-03** `gate_contract_lock.py` (force_ask); viết code trước GO doc → **G0-04** `gate_viability.py` (deny); bypass test/lint (`--no-verify`, `skip`) → **G0-05** `gate_test_bypass.py` (deny); dừng khi code vừa sửa chưa verify → **G0-06** `gate_stop_verify.py` (continue).

## 5. Vận hành

- **Write-time hooks chạy trước CI:** các gate ✅ ở mục 1–2 được chặn ngay lúc ghi file (PreToolUse/Stop = backstop tức thì; PostToolUse = ghi log vi phạm), không đợi pipeline. CI là lớp chặn cuối trước merge: BASE-0 → lint/static scan → Vitest → coverage (TST-1) → build + CFG-1/CFG-2 → Playwright E2E (TST-2, OBS-3) → dependency-cruiser (ARC-1/ARC-2).
- Mọi quyết định quay lui tuân theo Root Cause First; tối đa 3 lần sửa tại Stage 5 trước khi escalate lên Human (AGENTS.md).
- Các gate ⚠️ (CI-only: BASE-0, GRD-1, TST-1, TST-2, OBS-3, CFG-2) chưa có hook — lớp chặn là CI trước merge; các gate ✅ chặn ngay lúc ghi file nên không cần AI "tự kiểm" lại thứ hooks đã check.
