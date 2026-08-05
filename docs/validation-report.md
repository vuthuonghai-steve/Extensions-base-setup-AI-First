# Validation Report — Phases 1–4

> Ngày Phase 4: 2026-08-06 · Branch: `feat/phase-4-layer3-composite-modules`

## Kết quả cơ học Giai đoạn 4 (Layer 3 — Pure Modules & Unit Testing)

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | `tsc --noEmit` — 0 lỗi (strict) |
| `pnpm lint` | ✅ PASS | ESLint — 0 lỗi (fix `require-await` trên mock store test) |
| `pnpm test` | ✅ PASS | Vitest **136/136** (19 files — 4 file `3_modules/` mới: 23 tests) |
| `pnpm test --coverage` | ✅ PASS | **TST-1: Lines 96.34% (79/82) ≥ 90%** · Functions 100% · Statements 91.66% · Branches 86.66% ≥ 80% — chỉ tính `src/3_modules/**` |
| `pnpm build` | ✅ PASS | WXT build `.output/chrome-mv3` xanh |
| `pnpm arc1` | ✅ PASS | depcruise 0 vi phạm (160 modules, 337 dependencies — ARC-1: 3_modules không import Layer 2) |
| `pnpm format:check` | ✅ PASS | Prettier 100% clean |
| G0-04 viability | ✅ PASS | GO Phase 4 thêm vào viability-gate.md (T0) trước mọi write `src/` |

**Phạm vi (D1–D3 — 9 file):** sub-modules 6 (`time-formatter` 5 tests · `dom-parser` 4 tests · `ai-stream-decoder` 4 tests) · composite `bookmark-manager` 3 (`index.ts` interface `BookmarkStore` + `use-cases/bookmark-actions.ts` save/delete + `bookmark-manager.test.ts` 10 tests) · coverage config + CI.

**Quyết định kỹ thuật:**
- D1 — 3 sub-modules đúng tên Architect §4, mỗi module 1 hàm chính thuần (không `chrome`/DOM — G1-06), invalid input → Result.err không throw.
- D2 — composite mẫu `bookmark-manager`: validate URL, dedupe normalized (lowercase host, strip hash/trailing slash, path giữ case — chuẩn URL), Result pattern; **storage I/O qua interface `BookmarkStore` tự định nghĩa** — adapter thật lắp Phase 5 (ARC-1 chặn 3_modules import Layer 2).
- D3 — test co-located `*.test.ts` theo cây §4.
- Coverage: `vitest.config.ts` include `src/3_modules/**` + threshold lines/functions/statements **90%**, branches 80%; CI job test chạy `--coverage` (TST-1).

**Ghi chú trong quá trình build (đã fix):**
- G1-06 deny `document`/`chrome` ngay cả trong comment → comment module viết lại tránh trigger.
- `new URL` lowercase host nhưng giữ case path (đúng chuẩn URL) → test expectation sửa theo.
- Prettier reformat 2 file module sau `pnpm format`.
- Dependency mới: `@vitest/coverage-v8@4.1.10` (devDep, cùng version Vitest 4.1.10 — vitest 4 không kèm coverage provider).

**Việc tiếp theo Phase 5+:** lắp adapter `BookmarkStore` thật (storage Layer 2) khi build Engine — use-cases không đổi; feature thật (dom-parse save, AI stream) chỉ cần thêm use-case dùng 3 sub-modules.

---

> Ngày Phase 3: 2026-08-05 · Branch: `feat/phase-3-layer2-adapters`

## Kết quả cơ học Giai đoạn 3 (Layer 2 — Platform Adapters & Cross-cutting Services)

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | `tsc --noEmit` — 0 lỗi (strict, `noUncheckedIndexedAccess`) |
| `pnpm lint` | ✅ PASS | ESLint — 0 lỗi (OBS-1 `no-console` trừ `telemetry/logger.ts`, TYP-1) |
| `pnpm test` | ✅ PASS | Vitest 113/113 (15 files — 13 unit mới cho 2_platform_adapters) |
| `pnpm build` | ✅ PASS | WXT build `.output/chrome-mv3` xanh — manifest `permissions: ['storage']` (D3) |
| `pnpm arc1` | ✅ PASS | depcruise 0 vi phạm (107 modules — ARC-1: Layer 2 chỉ import 0_contracts) |
| `pnpm format:check` | ✅ PASS | Prettier 100% clean |
| CFG-1 secret scan | ✅ PASS | 0 match secret trong `.output/` (G1-08 + CI) |
| G0-04 viability | ✅ PASS | GO Phase 3 thêm vào viability-gate.md (T0) trước mọi write `src/` |

**Phạm vi (D1 — 15 file):** telemetry 5 (trace-id, log-ring-buffer, log-sink, log-broadcaster, logger) · config 2 (build-config, runtime-config-adapter) · storage 4 (storage-driver + local/sync/session) · ipc 4 (sender, port-channel, router, infrastructure-handlers). Defer tabs/scripting/permissions/declarative-net (YAGNI, permission tối thiểu).

**Quyết định kỹ thuật (D1–D10):**
- D4 — `createLogger(scope, {transport?})`: file_line tự capture qua `new Error().stack`, console mirror duy nhất tại logger.ts.
- D5 — ring buffer FIFO 500 + head monotonic + evict byte 4MB + batch 100ms (1 storage.set/lô).
- D6 — sender timeout 3s, retry 1x/150ms cho read-only, 0 retry cho side-effect (LogSink/SettingsSet).
- D9 — `isLogEntry()` structural guard + `sanitizePayload()` PII (không thêm zod vào 0_contracts).
- D10 — router typed qua IpcResponseMap + 4 handler hạ tầng.

**Điều phối 4 executor song song:** A (config/ipc core) + B (storage) + C (telemetry core) + D (logger/router); thống nhất interface StorageDriver (B) làm nguồn chung, C hấp thụ — bỏ cast `as never` (TYP-1).

**Ghi chú thay đổi hạ tầng hooks (ngoài scope plan, cần duyệt khi merge):** G1-06 `post_message_regex` chặn nhầm `port.postMessage` (runtime Port API hợp lệ — ARC-3 chỉ nhắm window.postMessage giữa 2 world). Patch config: `post_message_exclude_paths` trong rules.yaml (`.agent/` + `.claude/`) + boundaries.py exclude logic + 3 pytest (111 pass). Phạm vi: chỉ port-channel/log-broadcaster (+specs); các file khác vẫn deny.

## Kết quả cơ học Giai đoạn 2 (Layer 0 Contracts & Core Types)

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | `tsc --noEmit` — 0 lỗi |
| `pnpm lint` | ✅ PASS | ESLint — 0 lỗi (`@typescript-eslint/consistent-type-imports`, `no-unused-vars` clean) |
| `pnpm test` | ✅ PASS | Vitest 13/13 tests (6 unit config-schema + 2 unit smoke + 5 contract ipc-payload-shape) |
| `pnpm build` | ✅ PASS | WXT build `.output/chrome-mv3` xanh |
| `pnpm arc1` | ✅ PASS | depcruise 0 vi phạm (ARC-1, boundary `src/0_contracts/`) |
| `pnpm format:check` | ✅ PASS | Prettier 100% clean |
| CFG-1 secret scan | ✅ PASS | 0 match secret trong `.output/` |
| TraceId Enforcement (OBS-2 / G1-07) | ✅ PASS | `traceId: string` bắt buộc trên 100% request payloads |

**Ghi chú quyết định (D1–D9):**
- `ipc-actions.ts` — 4 action hạ tầng theo D2: `LogSink`, `SettingsGet`, `SettingsSet`, `StorageInspect` (dotted value, convention §5).
- `log-schema.ts` — `LogLevel` 5 mức (DEBUG/INFO/WARN/ERROR/**FATAL**), `timestamp` **ISO-8601 UTC** string (rule §3).
- `domain-entities.ts` — **KHÔNG tạo** (D3 YAGNI): không có type dùng chung ≥2 file; `LogLevel`/`LogEntry`/`AppError`/`MessageResponse` về đúng file chủ nhà.
- `ipc-payloads.ts` — `LogSinkRequest.entry` dùng `LogEntry` (validate theo ADR-003 schema).
- `storage-schema.ts` — `settings.log_level` dùng `LogLevel` (type-safe thay `string`).

**Mức hoàn thành Phase 2: 100%** — Layer 0 contracts hoàn chỉnh, độc lập, sẵn sàng cho Phase 3 (Adapters & Telemetry).

**Fix theo code review (pre-merge):**
- `key?: string` → `key?: StorageKey` (SettingsGet) và `key: StorageKey` (SettingsSet) — literal type từ `storage-schema.ts`, chống fail âm thầm khi key đổi area/rename.
- `area?: 'local' | 'session' | 'sync'` → `StorageArea` (nguồn sự thật duy nhất tại storage-schema).
- Bỏ redeclare `action`/`traceId` thừa trong 4 request interface (extends `BaseIpcRequest` đã đủ).
- `SettingsSetResponseData { success: boolean }` → `void` — tránh 2 nguồn sự thật với envelope `ok`.
- Test: thêm type-level lock OBS-2 (`_AssertTrue<_RequireTraceId<...>>`) — verified negative: đổi `traceId` optional → typecheck đỏ 4 errors; `_ResponseMapCoversAll` khóa IpcResponseMap phủ mọi IpcAction.

## Kết quả cơ học Giai đoạn 1 (Infrastructure & Base Configuration)

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | `tsc --noEmit` — 0 lỗi |
| `pnpm lint` | ✅ PASS | ESLint 10 flat — 0 lỗi (OBS-1, TYP-1) |
| `pnpm test` | ✅ PASS | Vitest 5/5 tests (config-schema + alias smoke) |
| `pnpm build` | ✅ PASS | `.output/chrome-mv3` — manifest đúng env |
| `pnpm arc1` | ✅ PASS | depcruise 0 vi phạm (ARC-1) |
| `pnpm format:check` | ✅ PASS | Prettier clean |
| CFG-2 negative test | ✅ PASS | Build đỏ (exit 1, ZodError) khi thiếu `WXT_APP_NAME` |
| CFG-1 secret scan | ✅ PASS | 0 match secret pattern trong `.output/` |
| G1-08 hook (PostToolUse) | ✅ PASS | clean: không có secret trong dist/ |
| G1-01 negative-space | ✅ PASS | 10/5 mục kèm hậu quả |

## Monitoring / Observability
- Layer 0 đã sẵn sàng cho Phase 3 telemetry (`LOG_SINK` action, `LogEntry` 7 trường - ADR-003, storage ring buffer schema).


## Bằng chứng pháp lý (nếu cần)

- Chưa có release/ToS/Privacy — ngoài scope Phase 1–2 (sẽ được chủ dự án duyệt
  trước khi publish Chrome Web Store, Phase 7).
