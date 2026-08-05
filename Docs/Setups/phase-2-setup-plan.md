# Kế hoạch Setup Giai đoạn 2 — Layer 0: Contracts & Core Types (Nguồn sự thật)

> **Trạng thái:** ✅ APPROVED — Đã duyệt toàn bộ §3 (D1–D9) và §8 (Q1–Q3), sẵn sàng thực thi T0–T8.
> **Vai trò:** AI Product & Development Agent theo `Docs/Trade-offs/AGENTS.md` (8-Stage Pipeline, Dual Context, Binary Gates).
> **Nguồn sự thật:** `Architect-workspace.md` (§4–5 Layer 0, §6.2 Logging, §10 ADR-002, §11 Gates) · `temps_phase.md` (Phase 2) · `.claude/rules/*` (config-and-environment, logging-and-observability, code-quality-and-gates, wxt-extension-architecture, tech-stack-and-conventions).
> **Branch:** `feat/phase-2-layer0-contracts` (đã tách từ main, sau khi merge PR #1).
> **Ngày khảo sát:** 2026-08-05 — hooks gate config verify trực tiếp từ `.agent/hooks/scripts/config/rules.yaml`.

---

## 1. Mục tiêu

Dựng toàn bộ định nghĩa type/contract trong `src/0_contracts/` — nguồn sự thật duy nhất cho type xuyên process (ADR-002). Layer 0 hoàn toàn độc lập, không import bất kỳ tầng nào; chỉ có type/enum/schema thuần, không side-effect. Output là nền tảng type-safe cho Phase 3 (Adapters + Telemetry) trở đi.

## 2. Hiện trạng đã khảo sát (Constraint Anchoring — S4)

| Hạng mục | Hiện trạng |
|---|---|
| `src/0_contracts/` | Chỉ có `config-schema.ts` (764B — Phase 1, D11 CFG-2) + `tests/unit/config-schema.spec.ts` |
| 5 file cần dựng | `ipc-actions.ts` / `ipc-payloads.ts` / `storage-schema.ts` / `domain-entities.ts` / `log-schema.ts` — chưa tồn tại |
| `tests/contract/` | Skeleton rỗng (Phase 1) — nơi đặt `ipc-payload-shape.spec.ts` (khóa shape traceId, OBS-2) |
| Path alias | `@contracts` → `src/0_contracts` ✅ (wxt.config.ts:9, sinh paths tự động qua `.wxt/tsconfig.json`) |
| Vitest | `4.1.10` + `WxtVitest()` ✅ — contract test chạy thuần, không mock chrome |
| Hooks gate active | **G0-03** force_ask mọi write `0_contracts/` · **G0-04** deny ghi `src/` nếu thiếu GO · **G1-07** traceId (target `0_contracts/ipc-payloads.ts`, cấm `traceId?`) · **G1-06** arch boundary (chrome_regex/dom_regex/ts_ignore áp dụng cả 0_contracts) · **G0-01/02** zero-value scan · **G1-01** doc_structure (negative-space.md đã tồn tại ✓) · **G2-01..04** evidence → continue |
| `docs/decisions/viability-gate.md` | **GO chỉ cover Phase 1 scope** ("Không viết code nguồn Phase 2+") — **cần update trước mọi write vào `0_contracts/`** hoặc G0-04 deny |
| ADR | ADR-002 (tập trung contracts — nền tảng phase này) · ADR-003 (Log Sink + Ring Buffer — xác định nhu cầu storage keys/LogEntry) |

## 3. Quyết định kỹ thuật (Stage 3 tinh chỉnh — chờ duyệt)

| # | Quyết định | Lý do (ràng buộc) | Nguồn |
|---|---|---|---|
| **D1** | **Phạm vi YAGNI — chỉ contract hạ tầng có nhu cầu thật từ Phase 3** | Dự án chưa có feature nào được chốt; "Bookmark, User" trong `temps_phase.md` chỉ là example. Entity/action/key feature giả = scaffolding rác, vi phạm Zero-Artifact (AGENTS.md §2) | User chốt (2026-08-05) |
| **D2** | `ipc-actions.ts` — `enum IpcAction` chỉ 4 action hạ tầng: `LOG_SINK`, `SettingsGet`, `SettingsSet`, `StorageInspect` | LOG_SINK = telemetry Phase 3 (ADR-003); Settings* = runtime-config Phase 3; StorageInspect = Debug Console OBS-3 (Phase 5). Feature action thêm khi feature được chốt | User chốt |
| **D3** | `domain-entities.ts` — **không tạo nếu không còn nội dung thật sau phân loại**; các type cơ sở về đúng file chủ nhà: `LogLevel`/`LogEntry` → `log-schema.ts`, `MessageResponse<T>` → `ipc-payloads.ts`, `AppEnv` → `config-schema.ts` | Tránh file rỗng/dup type. Nếu cần enum dùng chung (vd `LogLevel` cho cả log-schema + storage-schema), đặt tại `domain-entities.ts` — quyết định cuối tại T4 sau khi viết xong 3 file kia | User chốt hướng |
| **D4** | `ipc-payloads.ts` — discriminated union Request/Response theo từng `IpcAction`, `traceId: string` **bắt buộc không optional**, envelope `MessageResponse<T> = { ok: true; data: T } \| { ok: false; error: AppError }` | OBS-2 type-level (Architect §6.2) + hook G1-07 (regex `traceId\s*:` bắt buộc, cấm `traceId\s*\?`) | Architect §5, rules.yaml traceid |
| **D5** | `log-schema.ts` — `LogLevel` enum + `LogEntry` đủ **7 trường bắt buộc** (trace_id, scope, level, file_line, decision_reason, payload, timestamp) | ADR-003 + rule logging-and-observability §3; nguồn sự thật duy nhất schema log | Architect §6.2, logging rule §3 |
| **D6** | `storage-schema.ts` — chỉ **keys hạ tầng thật**: telemetry ring buffer (`telemetry.logs.*`, session — quota 6MB/4MB chia ngân sách 10MB session), SW session cache (`session.*`), runtime settings (`settings.*` — sync/local) | Phân bổ quota + evict theo byte (storage rule §7); keys feature chờ feature chốt | User chốt, storage rule §7 |
| **D7** | `AppError` dùng **discriminated union** (error_code enum + message + detail?) — nền cho Result pattern Phase 3 | Quy ước Result<T,E> (code-quality §3); tránh `string` mập mờ | code-quality rule §3 |
| **D8** | Test contract tại `tests/contract/ipc-payload-shape.spec.ts` — Vitest thuần, assert shape type (traceId bắt buộc qua type-level test + kiểm tra payload mẫu) | OBS-2 khóa shape khỏi phá vỡ; Layer 0 thuần không mock chrome | testing rule §3 |
| **D9** | Dùng `enum` thuần (không `const enum`/`as const`) cho `IpcAction` | Đặc tả §4 yêu cầu Enum; TS 6.0.3 + WXT compile an toàn | Architect §4 |

## 4. Reverse Probing (S2) — rủi ro & phòng ngừa

| # | Rủi ro | Khả năng | Phòng ngừa |
|---|---|---|---|
| R1 | **G0-04 deny** ghi `src/0_contracts/` vì viability-gate.md chỉ GO Phase 1 ("không viết code nguồn Phase 2+") | Chắc chắn | **Task 0**: update `docs/decisions/viability-gate.md` thêm GO Phase 2 scope **trước** mọi write vào `src/` |
| R2 | **G0-03 force_ask** từng file trong `0_contracts/` | Chắc chắn | Dự kiến 4–5 bước duyệt của user (1 file/lần); tuyệt đối không bypass — mỗi file là một contract riêng đáng review |
| R3 | **G1-07** fail nếu `traceId` viết dạng optional hoặc thiếu | Cao nếu lơ là | Viết type với `traceId: string` ngay từ đầu; sau khi ghi file chạy verify regex (mục §7) |
| R4 | **G1-06** deny nếu vô tình import `chrome.*`/`document`/`window` vào 0_contracts | Thấp | Layer 0 chỉ type/enum — không có lý do chạm chrome/DOM; ESLint + depcruise là lớp chặn cuối |
| R5 | **D3** thực thi sai: domain-entities rỗng → vẫn tạo file rác, hoặc ngược lại bỏ file cần | Trung bình | T4 quyết định sau khi viết log-schema/ipc-payloads; tiêu chí: có type nào 2+ file cùng dùng không |
| R6 | **G2-01..04 "continue"** sau khi tạo/update GO doc (thiếu deploy/monitoring/legal evidence) | Chắc chắn | **Chấp nhận** — evidence thuộc Phase 5–6; gate chỉ emit continue, không deny |
| R7 | Type drift: `AppError`/`LogLevel` bị định nghĩa rải rác sau này | Trung bình | D7/D5 tập trung tại 0_contracts; ARC-1 depcruise chặn import ngược |
| R8 | Enum `IpcAction` bị thêm action feature vội vàng (scope creep) | Trung bình | D2 cố định 4 action; action mới phải đi kèm handler thật (quy trình 5 bước §12 Architect) |

## 5. Danh sách task (T0 → T8) — mirror phase 1

> Mỗi task viết file xong đều chạy gate tương ứng (G0-03 duyệt, G1-06/07 backstop). Task cuối luôn verify toàn bộ (G0-06).

| # | Task | Chi tiết | Gate liên quan |
|---|---|---|---|
| **T0** | Update `docs/decisions/viability-gate.md` | Thêm GO Phase 2: "Layer 0 contracts (5 file, phạm vi hạ tầng D1–D9)" — trước mọi write src/ | G0-04 (tránh deny) |
| **T1** | `src/0_contracts/ipc-actions.ts` | `enum IpcAction` 4 action (D2) | G0-03, G1-06 |
| **T2** | `src/0_contracts/ipc-payloads.ts` | Base types + discriminated union Request/Response + `traceId: string` bắt buộc + `MessageResponse<T>` + `AppError` (D4, D7) | G0-03, G1-07, G1-06 |
| **T3** | `src/0_contracts/log-schema.ts` | `LogLevel` enum + `LogEntry` 7 trường (D5) | G0-03, G1-06 |
| **T4** | `src/0_contracts/domain-entities.ts` | **Quyết định D3**: tạo chỉ khi có type dùng chung ≥2 file (vd `LogLevel`); ngược lại ghi chú "không tạo — YAGNI" vào plan | G0-03 |
| **T5** | `src/0_contracts/storage-schema.ts` | Keys hạ tầng: `telemetry.*` (ring buffer session), `session.*` (SW cache), `settings.*` (runtime) — type literal per key (D6) | G0-03, G1-06 |
| **T6** | `tests/contract/ipc-payload-shape.spec.ts` | Vitest: assert traceId bắt buộc (type-level), payload mẫu hợp lệ, MessageResponse cả 2 nhánh (D8) | TST-1 tinh thần |
| **T7** | Verify toàn bộ | `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm arc1` + `pnpm format:check` | BASE-0, OBS-2, ARC-1, G0-06 |
| **T8** | CFG-1 + validation report | Scan `dist/` 0 match secret (G1-08 backstop) + `docs/validation-report.md` cập nhật kết quả phase 2 | CFG-1, G1-08 |

## 6. Kết quả mong đợi (Definition of Done)

- 5 file (hoặc 4 + quyết định YAGNI T4) trong `src/0_contracts/`, không import gì ngoài `zod`/`vitest` (test), 0 vi phạm G1-06/07.
- `tests/contract/ipc-payload-shape.spec.ts` xanh — shape traceId khóa khỏi phá vỡ (OBS-2).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm arc1 && pnpm format:check` 0 lỗi.
- CFG-1: scan `dist/` 0 match secret.
- `docs/validation-report.md` có bằng chứng phase 2 (kết quả từng lệnh gate).

## 7. Negative Space (mục lục §9 phase 1 — bổ sung)

| must_not | consequence_of_violation |
|---|---|
| Thêm action/entity/key feature chưa có use-case vào 0_contracts | Type chết không ai dùng, drift với thực tế; khi feature đến phải sửa contract → vỡ type xuyên process (ADR-002) |
| Đặt logic/chuỗi hằng xử lý vào 0_contracts | Layer 0 chỉ type/enum — có code chạy = mất thuần khiết, không test nổi tầng này |
| `traceId` optional trong ipc-payloads | G1-07 deny; mất chuỗi nhân-quả log 3 tầng (OBS-2, Architect §6.1) |
| Import `chrome.*`/`document`/`window` vào 0_contracts | G1-06 deny; Layer 0 không test được, vỡ quy tắc phụ thuộc (ARC-2 tinh thần) |

---

## 8. Quyết định đã duyệt

| # | Câu hỏi | Kết quả duyệt |
|---|---|---|
| Q1 | Duyệt toàn bộ §3 (D1–D9)? | ✅ APPROVED — Bắt đầu thực thi T0 |
| Q2 | Branch `feat/phase-2-layer0-contracts` (đã tách) | ✅ CONFIRMED — Đã ở đúng nhánh `feat/phase-2-layer0-contracts` |
| Q3 | T4 domain-entities: nếu không có type dùng chung → bỏ file, ghi chú YAGNI | ✅ AGREED — Thực hiện YAGNI nếu không có shared type |

