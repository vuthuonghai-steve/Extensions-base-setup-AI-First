# Kế hoạch Setup Giai đoạn 3 — Layer 2: Platform Adapters & Cross-cutting Services

> **Trạng thái:** 📋 DRAFT — Chờ duyệt toàn bộ §3 (D1–D10) và §8 (Q1–Q4) trước khi thực thi T0–T14.
> **Vai trò:** AI Product & Development Agent theo `Docs/Trade-offs/AGENTS.md` (8-Stage Pipeline, Dual Context, Binary Gates).
> **Nguồn sự thật:** `Architect-workspace.md` (§4–5 Layer 2, §6.2 Telemetry, §6.3 Config, §7 Testing, §10 ADR-003/004/007, §11 Gates) · `temps_phase.md` (Phase 3) · `.claude/rules/*` (config-and-environment, database-and-indexeddb-storage, logging-and-observability, testing-and-verification, wxt-extension-architecture, tech-stack-and-conventions).
> **Branch:** `feat/phase-3-layer2-adapters` (đã tách từ main, sau khi merge PR #2).
> **Ngày khảo sát:** 2026-08-05 — trạng thái hooks gate verify trực tiếp từ `.agent/hooks.json` + `.agent/hooks/scripts/config/rules.yaml`.

---

## 1. Mục tiêu

Dựng toàn bộ **Layer 2 — Platform Adapters & Cross-cutting Services** trong `src/2_platform_adapters/`: hệ thống Telemetry tập trung (`telemetry/`), Config (`config/`), Storage drivers (`storage/`) và IPC Router/Sender (`ipc/`). Layer 2 chỉ phụ thuộc `0_contracts` (ADR-002), được phép gọi `chrome.*` trực tiếp — đây là tầng duy nhất được "đụng" API native. Output là nền tảng để Layer 3 (Phase 4) mock adapter mà unit-test không cần Chrome thật, và để Layer 1 (Phase 5) chỉ việc lắp ráp.

## 2. Hiện trạng đã khảo sát (Constraint Anchoring — S4)

| Hạng mục | Hiện trạng |
|---|---|
| `src/2_platform_adapters/` | **Chưa tồn tại** (0 file) — branch `feat/phase-3-layer2-adapters` đã tách sạch từ main |
| Layer 0 contracts (input) | ✅ Đủ cho Phase 3: 4 IPC action (`LogSink`, `SettingsGet`, `SettingsSet`, `StorageInspect`) · `IpcResponseMap` type-map action→response · `LogEntry` 7 trường · `LogLevel` 5 mức · storage keys hạ tầng (`telemetry.logs.buffer/head`, `session.sw_active_timestamp`, `settings.theme/telemetry_enabled/log_level`, `settings.sync_preferences`) · `StorageKey`/`StorageArea` · `MessageResponse<T>`/`AppError` · `envSchema` có `WXT_LOG_LEVEL` |
| Path alias | `@platform` → `src/2_platform_adapters` ✅ (wxt.config.ts:11); alias `@contracts`/`@engine`/`@modules`/`@presentation` ✅ |
| Manifest | `permissions: []` — **cần thêm `storage`** cho drivers + ring buffer lúc runtime (wxt.config.ts:23) |
| Vitest + mock chrome | ✅ **Không cần dependency mới**: `WxtVitest()` tự `vi.stubGlobal("chrome", fakeBrowser)` (extensionApiMock plugin) — `@webext-core/fake-browser@2.0.1` đóng gói sẵn trong WXT. Verify: fake-browser **hỗ trợ đủ** `storage.local/sync/session` + `getBytesInUse` + `onChanged` + `runtime.sendMessage/onMessage/connect` (Port) — quét `dist/src-W-WGXBaG.mjs`) |
| ESLint | OBS-1 `no-console` = `error` trên `src/**` **trừ** `**/telemetry/logger.ts` (eslint.config.mjs:52-59) — G1-06 regex `console\.(log\|debug\|warn)` ngoài logger file |
| G1-06 arch boundary | `chrome_regex`/`dom_regex` **chỉ áp dụng `3_modules/`** → adapter Layer 2 được phép gọi `chrome.*` hợp lệ; cấm `as any`/`@ts-ignore` mọi nơi |
| depcruise ARC-1 | ✅ **Đã có rule** `arc-1: platform-khong-ngo` — `2_platform_adapters` không được import `1_engine/3_modules/4_presentation` (chỉ được import `0_contracts`) |
| Hooks gate active | **G0-04** deny ghi `src/` nếu `docs/decisions/viability-gate.md` thiếu `GO` Phase 3 (hiện chỉ cover Phase 1–2, mục "Không viết logic nghiệp vụ Phase 3+" — **chắc chắn deny**) · **G0-01** placeholder deny · **G0-03** force_ask nếu đụng `0_contracts/` · **G0-06** stop-verify · **G1-06** backstop · **G1-08** secret scan sau build · **G2-01..04** continue (chấp nhận như Phase 2) |
| CI | BASE-0, TST-1 (vitest run), CFG-2, ARC-1, CFG-1 active (`.github/workflows/ci.yml`) |
| Docs pattern | `docs/validation-report.md` (bằng chứng Phase 1–2) · `docs/negative-space.md` tồn tại · `docs/decisions/viability-gate.md` cần update |

## 3. Quyết định kỹ thuật (Stage 3 tinh chỉnh — chờ duyệt)

| # | Quyết định | Lý do (ràng buộc) | Nguồn |
|---|---|---|---|
| **D1** | **Phạm vi YAGNI — chỉ 4 domain có consumer thật ngay**: `telemetry/` (5 file), `config/` (2 file), `storage/` (3 driver), `ipc/` (3 file). **Defer** `tabs/`, `scripting/`, `permissions/`, `declarative-net/` sang phase có consumer đầu tiên (Phase 4 modules / Phase 5 engine) | (1) 4 adapter đó có **0 consumer thật** trước khi feature được chốt — tạo = dead code, vi phạm Zero-Artifact + D1 Phase 2. (2) `tabs-adapter` cần manifest permission `tabs`; `rules-adapter` cần `declarativeNetRequest` — khai báo permission sớm vì adapter chết = vi phạm "permission tối thiểu" (§1.4 Chrome Web Store). (3) `temps_phase.md` liệt kê tabs/scripting/permissions… là danh sách Layer 2 "đầy đủ" trong tương lai, không phải lệnh build ngay | User chốt hướng (Q1) — kế thừa D1 Phase 2 |
| **D2** | `ipc/port-channel.ts` + `telemetry/log-broadcaster.ts` **build trong Phase 3** dù consumer (Debug Console) ở Phase 5 | Port + broadcaster là **hạ tầng** Layer 2 theo Architect §4 (không phải feature); OBS-3 (Phase 6) phụ thuộc chúng sẵn sàng; test được đầy đủ qua fake-browser `connect`. Tiền lệ: Phase 2 D2 đã build `StorageInspect` có consumer ở Phase 5 | Architect §4, ADR-003 |
| **D3** | **Manifest: thêm permission `storage`** vào `wxt.config.ts` — 1 thay đổi duy nhất; **không** thêm `tabs`/`scripting`/`declarativeNetRequest` | Drivers + ring buffer gọi `chrome.storage` lúc runtime; các permission khác chờ feature thật (D1) | Architect §6.2/§6.3 |
| **D4** | `logger.ts` — factory `createLogger(scope, { transport? })`: mặc định transport = IPC sender (context không phải Background); Background (Phase 5) truyền transport direct → log-sink. `file_line` **tự capture** qua `new Error().stack` parse, fallback `"unknown"` | "Mỗi context một logger instance" (Architect §6.2); wide-event structured — cấm log chuỗi không cấu trúc (logging-best-practices); bắt caller truyền file_line thủ công = boilerplate, AI sẽ quên | Architect §6.2, skill logging-best-practices |
| **D5** | Ring buffer: `telemetry.logs.buffer` = LogEntry[] **FIFO cap 500** + `telemetry.logs.head` = **monotonic counter** tổng entries đã append (dùng đủ 2 keys theo contract, head phục vụ ordering). **Evict theo BYTE**: trước mỗi set check `getBytesInUse('session')` budget **4MB log** (chia ngân sách 10MB session: 4MB log / 6MB SW cache); vượt → slice entries cũ theo byte ước lượng. **Batch append**: gom log theo cửa sổ (vd 100ms) → 1 `storage.set` cho cả lô (rule cấm set từng key trong for; né rate limit ~120 writes/phút). Quota exceeded → fallback memory SW (non-durable) + cảnh báo qua logger | Storage rule §7–§8 (evict byte, batch, quota 10MB) | |
| **D6** | `ipc/sender.ts` — `sendMessage<T>(action, payload, opts?)`: timeout **3s**, **retry policy theo tính idempotent**: action read-only (SettingsGet/StorageInspect) → retry 1 lần sau 150ms (SW "ngủ" làm mất message đầu); action có side-effect (LogSink/SettingsSet) → **retry=0** (tránh duplicate). Trả `MessageResponse<T>` — **không throw**. `traceId` tự inject nếu caller thiếu | SW bị kill → message đầu fail âm thầm (§1.3 #5); duplicate side-effect = log trùng/ghi trùng settings | Architect §5, wxt rule §5 |
| **D7** | `runtime-config-adapter.ts` — `getSetting(key)`: storage → fallback **build-config default** → undefined; `setSetting` batch (1 set nhiều key); `subscribe` qua `chrome.storage.onChanged` (reactive, không cần reload) | Config rule §6 (reactive, fallback); bảng 4 loại config §6.3 (settings = preference → sync/local) | config rule §2/§6 |
| **D8** | **Unit test adapters qua fake-browser** (`wxt/testing/fake-browser` — đã có sẵn, 0 dependency mới) tại `tests/unit/2_platform_adapters/*.spec.ts`; node env (không cần DOM) | Testing rule §3 — mock chrome qua fake-browser; WxtVitest đã stub global `chrome` | testing rule §3, ADR-005 |
| **D9** | `log-sink.ts` validate entry bằng **structural type guard** `isLogEntry()` (viết tay, type-check với `LogEntry`) + **sanitize PII** payload (regex `sk-`, `Bearer`, `password`…) trước khi persist — **không** thêm zod schema | LogEntry là type (không phải schema) — thêm zod vào 0_contracts = 2 nguồn sự thật + G0-03 force_ask không cần thiết; guard type-safe đủ cho boundary; PII trong payload = vi phạm logging rule §4 | logging rule §3/§4 |
| **D10** | `ipc/router.ts` — `registerHandler(action, handler)` + `handle(request)` typed qua `IpcResponseMap`; Phase 3 thêm `ipc/infrastructure-handlers.ts` đăng ký **4 handler hạ tầng** (LogSink→log-sink, SettingsGet/Set→runtime-config, StorageInspect→storage driver read) — engine Phase 5 chỉ gọi bootstrap 1 lần | Router là lớp dispatch trung tâm (§5 Layer 2); handler hạ tầng có logic thật ngay trong Phase 3 → test được; Phase 5 không phải viết lại | Architect §5 |

## 4. Reverse Probing (S2) — rủi ro & phòng ngừa

| # | Rủi ro | Khả năng | Phòng ngừa |
|---|---|---|---|
| R1 | **G0-04 deny** ghi `src/2_platform_adapters/` vì viability-gate.md chưa có GO Phase 3 | Chắc chắn | **Task 0**: update viability-gate.md thêm GO Phase 3 scope **trước** mọi write vào `src/` |
| R2 | G1-06 deny nếu `console.log/warn` vô tình ngoài `logger.ts` | Trung bình | Chỉ dùng API của `createLogger`; test telemetry spy qua `vi.spyOn(console, ...)` — không gọi console trần trong code |
| R3 | fake-browser thiếu API bất ngờ (vd `storage.session.setAccessLevel`) → test fail | Thấp | T-verify ngay đầu phase (T1.5): smoke test `chrome.storage.session` + `runtime.connect` trên fake-browser; thiếu → viết mock thủ công cho phần thiếu (helper `tests/helpers/`) |
| R4 | `import.meta.env` trong Vitest khác dev env → build-config đọc sai `WXT_LOG_LEVEL` | Trung bình | Verify globals plugin (WxtVitest inject `import.meta.env.*` từ wxt.config); test build-config theo từng mode qua `vi.stubEnv` |
| R5 | Vòng import nội Layer 2: `log-ring-buffer` cần `logger` (cảnh báo degradation) trong khi `logger` → `log-sink` → ring buffer | Thấp (cùng thư mục `telemetry/`, không phải vòng layer — depcruise chỉ chặn cross-layer) | Bất biến: **`logger.ts` KHÔNG import ring-buffer/sink** (chỉ import `trace-id` + `config` + `ipc/sender`); ring-buffer gọi `createLogger('telemetry')` — 1 chiều an toàn |
| R6 | Duplicate side-effect do retry (LogSink append 2 lần, SettingsSet ghi 2 lần) | Trung bình | D6: retry chỉ cho action read-only; side-effect action retry=0 |
| R7 | PII lọt vào log payload | Trung bình | D9 sanitize ở log-sink + quy ước dev không đưa secret vào payload (logging rule §4) |
| R8 | Scope creep: vô tình build tabs/scripting/permissions vì "đã liệt kê trong temps_phase" | Trung bình | Negative Space §7 khóa chặt; D1 được duyệt = danh sách file chính xác trong T1–T12 |
| R9 | Rate limit storage (~120 writes/phút) nếu log dày | Trung bình | D5 batch append cửa sổ 100ms + cap FIFO; log debug ở mức thấp trong production (`WXT_LOG_LEVEL=info`) |
| R10 | G2-01..04 "continue" (thiếu deploy/monitoring/legal evidence) | Chắc chắn | **Chấp nhận** như Phase 2 — evidence thuộc Phase 5–6; gate chỉ emit continue |

## 5. Danh sách task (T0 → T14)

> Mỗi task viết file xong chạy gate tương ứng (G1-06 backstop, G0-06 verify). Task cuối luôn verify toàn bộ (G0-06).

| # | Task | Chi tiết | Gate liên quan |
|---|---|---|---|
| **T0** | Update `docs/decisions/viability-gate.md` | Thêm GO Phase 3: "Layer 2 platform adapters (telemetry/config/storage/ipc — phạm vi D1–D10)" — **trước mọi write src/** | G0-04 (tránh deny) |
| **T1** | `src/2_platform_adapters/telemetry/trace-id.ts` | `createTraceId()` — `crypto.randomUUID()` + fallback random; test | G1-06 |
| **T1.5** | Verify fake-browser capability | Smoke test `chrome.storage.session` + `runtime.connect`/`sendMessage` trên fake-browser (R3) — fail sớm, không đợi tới T3/T6 | TST-1 tinh thần |
| **T2** | `src/2_platform_adapters/config/build-config.ts` | Đọc `import.meta.env` (Vite build-time): mode, app name/description, `LOG_LEVEL` (parse `WXT_LOG_LEVEL` → `LogLevel`); export hằng tĩnh; test từng mode | G1-06 |
| **T3** | `src/2_platform_adapters/storage/` — 3 drivers | `local-driver.ts` / `sync-driver.ts` / `session-driver.ts`: interface chung (get/set/remove/getBytesInUse/onChanged, typed `StorageKey`); lỗi → `AppError(STORAGE_ERROR)` không throw; test qua fake-browser | G1-06 |
| **T4** | `src/2_platform_adapters/config/runtime-config-adapter.ts` | `getSetting`/`setSetting`/`subscribe` (D7); fallback build-config; test | G1-06 |
| **T5** | `src/2_platform_adapters/ipc/sender.ts` | `sendMessage` typed + timeout 3s + retry policy idempotent (D6) + traceId auto-inject; test (fake `runtime.sendMessage` + timer) | G1-06 |
| **T6** | `src/2_platform_adapters/ipc/port-channel.ts` | `openPort`/`onPortConnect` wrapper + disconnect/reconnect handling; test (fake `connect`/`onConnect`) | G1-06 |
| **T7** | `src/2_platform_adapters/telemetry/log-ring-buffer.ts` | FIFO cap 500 + head counter + evict byte + batch append 100ms (D5); test (fake storage.session + byte budget) | G1-06 |
| **T8** | `src/2_platform_adapters/telemetry/log-sink.ts` | `isLogEntry()` guard + sanitize PII + persist qua ring buffer + notify broadcaster (D9); test | G1-06 |
| **T9** | `src/2_platform_adapters/telemetry/log-broadcaster.ts` | Broadcast entry tới connected ports qua port-channel (D2); test (fake connect + payload nhận được) | G1-06 |
| **T10** | `src/2_platform_adapters/telemetry/logger.ts` | `createLogger(scope, {transport?})`: level filter (build-config) + console mirror (duy nhất được phép) + gửi `LogSink` IPC (retry=0) + file_line auto-capture (D4); test (spy console + fake runtime) | G1-06, OBS-1 |
| **T11** | `src/2_platform_adapters/ipc/router.ts` + `infrastructure-handlers.ts` | `registerHandler`/`handle` typed (IpcResponseMap) + 4 handler hạ tầng (D10); test cả 4 nhánh + 2 nhánh envelope | G1-06 |
| **T12** | `wxt.config.ts` — manifest `storage` permission (D3) | 1 dòng `permissions: ['storage']`; rebuild xanh | CFG-2 |
| **T13** | Verify toàn bộ | `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm arc1 && pnpm format:check` + CFG-1 scan `dist/` 0 match secret | BASE-0, TST-1, ARC-1, CFG-1, G0-06 |
| **T14** | Update `docs/validation-report.md` | Bảng bằng chứng Phase 3 (kết quả từng lệnh gate) — theo pattern Phase 2 | G2-02 tinh thần |

## 6. Kết quả mong đợi (Definition of Done)

- 14 file trong `src/2_platform_adapters/` (telemetry 5 + config 2 + storage 3 + ipc 4 — gồm router, infrastructure-handlers, sender, port-channel), chỉ import từ `0_contracts` + `wxt/browser`/global `chrome`, 0 vi phạm G1-06.
- Test unit mới tại `tests/unit/2_platform_adapters/` phủ: trace-id, build-config, 3 storage drivers, runtime-config, sender (timeout/retry), port-channel, ring buffer (evict/batch), log-sink (guard + PII), broadcaster, logger (console + IPC), router (4 handler). Tất cả chạy trên fake-browser — 0 dependency mới.
- Chuỗi telemetry ADR-003 hoàn chỉnh ở tầng adapter: `logger → sender(LogSink) → router → log-sink → ring-buffer(+broadcaster)` — test xanh (wiring vào engine thật là Phase 5).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm arc1 && pnpm format:check` 0 lỗi.
- CFG-1: scan `dist/` 0 match secret.
- `docs/validation-report.md` có bằng chứng Phase 3.

## 7. Negative Space (bổ sung từ Phase 1–2)

| must_not | consequence_of_violation |
|---|---|
| Build `tabs/`/`scripting/`/`permissions/`/`declarative-net/` adapter khi chưa có consumer thật | Dead code + khai báo manifest permission thừa (tabs/declarativeNetRequest) → Chrome Web Store soi permission tối thiểu (§1.4), vỡ D1 YAGNI Phase 2 |
| `console.log/warn/error` trần ngoài `telemetry/logger.ts` | G1-06 deny + ESLint OBS-1 fail; log phân mảnh mất chuỗi nhân-quả (ADR-003) |
| `log-ring-buffer` set từng entry 1 lần `storage.set` trong for / không evict byte | Rate limit ~120 writes/phút + quota 10MB session tràn → mất log, mất SW cache đồng thời (storage rule §7–§8) |
| Retry không idempotent cho action side-effect (LogSink/SettingsSet) | Duplicate log entry / ghi settings 2 lần — dữ liệu nhiễu khó debug |
| Đưa PII/secret (password, token, OTP) vào `LogEntry.payload` | Log lộ thông tin người dùng — vi phạm logging rule §4, rủi ro pháp lý |
| Đụng `0_contracts/` để "tiện thêm type" khi chưa có consumer thật | G0-03 force_ask; type chết + drift (D1 Phase 2) — contract hiện tại đã đủ cho Phase 3 |
| `import.meta.env` bị gọi trực tiếp rải rác ngoài `config/build-config.ts` | Config tản mạn, thiếu nguồn sự thật; Phase 3 không có lý do gọi env ngoài build-config |

---

## 8. Quyết định chờ duyệt

| # | Câu hỏi | Lựa chọn | Khuyến nghị |
|---|---|---|---|
| Q1 | **D1 — Phạm vi Phase 3** | **A.** Chỉ 4 domain có consumer thật (telemetry/config/storage/ipc — 14 file), defer tabs/scripting/permissions/declarative-net · **B.** Build đủ 8 domain theo tree Architect (thêm ~4 adapter + permission manifest) | **A (Recommended)** — YAGNI + permission tối thiểu; consistent D1 Phase 2 |
| Q2 | Duyệt toàn bộ §3 (D2–D10)? | ✅ / chỉnh sửa | ✅ — mỗi D đều có nguồn ràng buộc cụ thể |
| Q3 | Branch `feat/phase-3-layer2-adapters` (đã tách) | ✅ / đổi nhánh | ✅ — đúng pattern Phase 1–2 |
| Q4 | D3 — thêm manifest permission `storage` | ✅ / giữ `[]` | ✅ — bắt buộc cho drivers + ring buffer lúc runtime |
