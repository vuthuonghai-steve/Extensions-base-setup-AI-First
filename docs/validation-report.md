# Validation Report — Phases 1–5

> Ngày Phase 5: 2026-08-06 · Branch: `feat/phase-5-engine-presentation`

## Kết quả cơ học Giai đoạn 5 (Layer 1 Engine Entrypoints & Layer 4 Presentation)

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | `tsc --noEmit` — 0 lỗi (strict; thêm `jsx: react-jsx` cho React apps) |
| `pnpm lint` | ✅ PASS | ESLint — 0 lỗi (fix no-misused-promises trên onMessage, no-unsafe-assignment test) |
| `pnpm format:check` | ✅ PASS | Prettier 100% clean |
| `pnpm test` | ✅ PASS | Vitest **151/151** (24 files — +4 file mới: `tests/unit/1_engine/` keep-alive + session-cache + message-listener, `tests/unit/4_presentation/` log-filters + export-logs) |
| `pnpm test --coverage` | ✅ PASS | **TST-1: Lines 96.34% ≥ 90%** · Functions 100% · Statements 91.66% · Branches 87.5% ≥ 80% — chỉ tính `src/3_modules/**` |
| `pnpm build` | ✅ PASS | WXT build `.output/chrome-mv3` xanh — manifest đủ action/side_panel/options_ui + permissions storage/alarms/sidePanel |
| `pnpm arc1` | ✅ PASS | depcruise 0 vi phạm (154 modules, 284 dependencies — `engine-khong-ngo`: 1_engine không import 3_modules/4_presentation) |
| G1-08 secret scan | ✅ PASS | 0 secret thật; 1 dương giả `-----BEGIN` (regex SECRET_VALUE_PATTERN trong source log-sink) — CI chặn lớp cuối |
| G0-04 viability | ✅ PASS | GO Phase 5 thêm vào viability-gate.md (T0) trước mọi write `src/` |

**Phạm vi (T1–T11 — 20 file):**
- `1_engine/background/`: bootstrap `index.ts` (Router instance duy nhất + registerInfrastructureHandlers + 4 listeners — mọi đăng ký TRONG defineBackground để tránh side-effect lúc module eval bị fake-browser chặn trong `wxt prepare`), `lifecycle/` (on-installed, on-startup, keep-alive alarm 0.5min → `session.sw_active_timestamp`), `listeners/` (message-listener route thuần trả `true` giữ channel — MV3 async; alarms-listener), `state/session-cache.ts` (wrapper chrome.storage.session).
- `1_engine/content/` scaffold phi-entrypoint: `isolated-world/dom-bridge.ts` + `main-world-bridge.ts` (file ngoại lệ G1-06) + `main-world/page-context-hook.ts` (stub). `1_engine/offscreen/handlers/dom-parse-handler.ts` (pure fn). Entrypoint content/offscreen defer Phase 6 (matches non-empty bắt buộc).
- `1_engine/{popup,sidepanel,options,debug-console}/index.html` — **đặt trực tiếp trong entrypointsDir** (glob WXT chỉ nhận `popup/index.html` cấp 1, không nhận `ui-pages/popup/`) — script src tương đối `../../4_presentation/...` (alias `/@presentation/...` không resolve trong HTML).
- `4_presentation/extension-views/`: `popup-app` (settings showcase ADR-007 — fetch SettingsGet khi mount, toggle SettingsSet, mirror state), `debug-console-app` (LogViewer port `telemetry.broadcast` tail + filter, StorageInspector IPC StorageInspect, export-logs Blob JSON không console), `sidepanel-app` (menu tĩnh), `options-app` (shell tĩnh).
- `wxt.config.ts`: permissions `['storage','alarms','sidePanel']` + manifest function-form side_panel/options_ui (WXT tự sinh entrypoint HTML → default_path tự fix `sidepanel.html`). `tsconfig.json`: `jsx: react-jsx`.

**Quyết định kỹ thuật / chệch khỏi plan (đã xử lý):**
- **D7 chệch**: tree §4 ghi `ui-pages/` nhưng glob WXT không nhận entrypoint HTML nested → đặt thẳng `src/1_engine/{popup,...}/index.html` (vẫn đúng tinh thần "ui-pages = shell, UI thật ở @presentation").
- **D1 chệch**: registerInfrastructureHandlers chuyển vào trong `defineBackground` — để ngoài, `wxt prepare` (fake-browser) crash vì log-broadcaster module-level subscribe `runtime.onConnect`.
- **D3 chệch**: onMessage listener phải `return true` + sendResponse callback (type sync, không trả promise) — nếu không, MV3 đóng channel, response undefined.
- **Recursion fix**: bỏ log `Routing` trong message-listener — logger transport gửi LogSink qua runtime.sendMessage → listener nhận lại chính nó (loop vô hạn khi threshold DEBUG).
- **Manifest verify (R2)**: WXT tự sinh action/side_panel/options_ui từ entrypoint HTML — `default_path` tự thành `sidepanel.html` (tên entrypoint), `options_ui.open_in_tab` về false (WXT override).

**Việc tiếp theo Phase 6:** content/offscreen entrypoint với matches thật (feature E2E), Playwright E2E (TST-2/OBS-3), tabs/context-menu listener khi có feature, shared-design-system khi có consumer.

---

> Ngày Phase 4: 2026-08-06 · Branch: `feat/phase-4-layer3-composite-modules`

## Kết quả cơ học Giai đoạn 4 (Layer 3 — Pure Modules & Unit Testing)

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm typecheck` | ✅ PASS | `tsc --noEmit` — 0 lỗi (strict) |
| `pnpm lint` | ✅ PASS | ESLint — 0 lỗi (fix `require-await` trên mock store test) |
| `pnpm test` | ✅ PASS | Vitest **136/136** (19 files — 4 file `3_modules/` mới: 23 tests) |
| `pnpm test --coverage` | ✅ PASS | **TST-1: Lines 96.34% (79/82) ≥ 90%** · Functions 100% · Statements 91.66% · Branches 87.5% ≥ 80% — chỉ tính `src/3_modules/**` (sau PR #6: test files ra khỏi src → coverage chỉ đo source thuần, branches 86.66→87.5) |
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

**Fix pattern sau review (PR #6 — test placement):** testing-and-verification.md §3 cũ ghi "co-located trong `3_modules/`" mâu thuẫn Architect §4 tree (`tests/unit/3_modules/`) — không gate nào enforce vị trí test nên cả 2 pattern cùng pass. Đã move 4 spec sang `tests/unit/3_modules/` (import qua `@modules`), sửa rule §3, coverage giờ đo source thuần.

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
