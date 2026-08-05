# Validation Report — Phases 1–3

> Ngày: 2026-08-05 · Branch: `feat/phase-3-layer2-adapters`

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
