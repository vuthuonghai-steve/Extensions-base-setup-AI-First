# Kế hoạch Setup Giai đoạn 5 — Layer 1 Engine Entrypoints & Layer 4 Presentation

> **Trạng thái:** 📝 PLANNED — chờ duyệt (2026-08-06)
> **Vai trò:** AI Product & Development Agent theo `Docs/Trade-offs/AGENTS.md` (8-Stage Pipeline, Dual Context, Binary Gates).
> **Nguồn sự thật:** `Architect-workspace.md` (§4–5 Layer 1/4, §6.2 Telemetry, §7 Testing, §8 Ma trận Quyền hạn, §9 Phụ thuộc, §11 Gates) · `temps_phase.md` (Phase 5) · `.claude/rules/*` (wxt-extension-architecture, ui-architecture-conventions, logging-and-observability, code-quality-and-gates, testing-and-verification).
> **Branch:** `feat/phase-5-engine-presentation` (tách từ main sau merge).

---

## 1. Mục tiêu

Dựng Layer 1 (Engine — Register & Listen) + Layer 4 (Presentation) để **wiring** toàn hệ thống: Background bootstrap đăng ký Router + handler hạ tầng, route IPC, keep-alive; Popup/SidePanel/Options/Debug Console shell + React apps. Engine KHÔNG chứa business logic — chỉ đăng ký sự kiện, route message, khởi tạo state cache.

**Thước đo hoàn tất:** mọi entrypoint WXT build vào `.output/chrome-mv3` với manifest hợp lệ (action popup, side_panel, options_ui); popup fetch+ghi settings qua IPC xuyên Background→storage; Debug Console tail log real-time qua Port (nền cho OBS-3 E2E Phase 6).

## 2. Hiện trạng đã khảo sát (Constraint Anchoring — S4)

| Hạng mục | Hiện trạng |
|---|---|
| `src/1_engine/` | Chỉ `background/index.ts` shell rỗng (defineBackground trống). `content/`, `offscreen/`, `ui-pages/` = 0 file |
| `src/4_presentation/` | 4 dir rỗng (`extension-views/`, `main-world-ui/`, `shadow-dom/`, `shared-design-system/`) |
| Layer 2 (sẵn sàng wiring) | ✅ `Router` (registerHandler/handle — không throw) · `sender` (timeout+retry, phân loại read-only D6) · `port-channel` (`openPort`) · **`infrastructure-handlers.ts`** đã đăng ký sẵn 4 handler: LogSink, SettingsGet, SettingsSet, StorageInspect · `log-broadcaster` (port `telemetry.broadcast`, set module-load) · `logger`/`trace-id`/`log-ring-buffer`/`runtime-config-adapter` |
| Layer 0 contracts | ✅ Đủ 4 action (LogSink/SettingsGet/SettingsSet/StorageInspect) + `IpcResponseMap` khóa shape + `StorageKey` đã có `session.sw_active_timestamp` (cho keep-alive). **KHÔNG thêm contract mới** (G0-03 không trigger, YAGNI) |
| wxt.config | `entrypointsDir = src/1_engine` → background/ + ui-pages/*.html + content/ + offscreen/ tự nhận là entrypoint. Manifest function-form, permission hiện chỉ `storage`, chưa có action/side_panel/options_ui |
| Hooks gate | **G0-04** deny ghi `src/` nếu viability-gate.md thiếu GO Phase 5 → **T0 bắt buộc** · **G1-06** deny console.log trần / window.postMessage trần (ngoài bridge) / `as any` / `@ts-ignore` · **G0-03** force_ask khi đụng `0_contracts/` (tránh) · **G0-06** stop-verify · **G1-09** chặn test trong `src/` |
| depcruise ARC-1 | `engine-khong-ngo`: `1_engine` không import `3_modules`/`4_presentation` — engine chỉ import `2_platform_adapters` + `0_contracts` · `4_presentation` tự do import |
| Vitest | `WxtVitest()` + happy-dom có sẵn — component test 4_presentation OK |
| Manifest ràng buộc Chrome | `content_scripts.matches` **bắt buộc non-empty** — không khai được entrypoint content với `matches: []`; `chrome.offscreen.createDocument` bắt buộc `url` + `reasons` hợp lệ |

## 3. Quyết định kỹ thuật (Stage 3 — chờ duyệt)

| # | Quyết định | Lý do (ràng buộc) |
|---|---|---|
| **D1** | Background bootstrap: `new Router()` + `registerInfrastructureHandlers(router)` + `registerMessageListener` + lifecycle. Router là **instance duy nhất** module-level | Router comment Phase 3 ghi sẵn: engine đăng ký handler 1 lần tại bootstrap |
| **D2** | `keep-alive.ts`: alarm `alarms.create('keep-alive', { periodInMinutes: 0.5 })` (MV3 min period 30s), listener ghi `session.sw_active_timestamp` qua `session-cache.ts` — dùng key đã có sẵn trong storage-schema | §4 tree; SW bị idle-kill ~30s → né bằng alarm pattern. **`alarms` permission phải thêm** |
| **D3** | `message-listener.ts` chỉ route: `browser.runtime.onMessage` → extract request → `router.handle()` → trả `MessageResponse`. Log qua logger (scope `background`) kèm traceId | §3, §5; không xử lý nghiệp vụ trong listener |
| **D4** | `tabs-listener.ts` + `context-menu-listener.ts`: **defer** (không consumer, cần `contextMenus` permission). `alarms-listener.ts` là lifecycle thuần (onStartup → schedule, onInstalled → init) — nhập chung vào `lifecycle/` | YAGNI; tree §4 liệt kê nhưng chưa có feature cần tabs/context-menu |
| **D5** | Content scaffold **phi-entrypoint**: `isolated-world/dom-bridge.ts` + `main-world-bridge.ts` (hàm gửi/nhận message 2 chiều giữa 2 world — `main-world-bridge.ts` đúng bridge_file ngoại lệ G1-06; `dom-bridge.ts` không cần ngoại lệ vì không gửi message qua bridge) + `main-world/page-context-hook.ts` (export stub đọc biến trang, chưa dùng). **`content/isolated-world/index.ts` + `main-world/index.ts` entrypoint DEFER Phase 6** — kèm `matches` thật (VDURL của feature E2E) | Chrome bắt buộc `matches` non-empty; khai rỗng = manifest invalid, build rác. User đã chọn "scaffold theo tree §4" — scaffold module + defer entrypoint là cách tôn trọng tree mà build vẫn xanh |
| **D6** | Offscreen scaffold: `offscreen/handlers/dom-parse-handler.ts` (pure fn, test được). Entrypoint `offscreen/index.ts` DEFER Phase 6 — `createDocument` cần `url`+`reasons` thật | Tương tự D5; chưa feature nào cần DOM ẩn (YAGNI) |
| **D7** | `ui-pages/`: `popup/index.html`, `sidepanel/index.html`, `options/index.html`, `debug-console/index.html` — WXT entrypoint HTML, import React app từ `@presentation`. Options = shell tĩnh đơn giản (tree §4 không có options-app) | §4 tree; WXT tự sinh manifest action/side_panel/options_ui theo entrypoint |
| **D8** | Popup-app = **settings showcase** (ADR-007 — view thuần): mount → fetch `SettingsGet` (theme, telemetry_enabled, log_level) → toggle ghi `SettingsSet` → nút "Open Debug Console". **Không giữ business state trong React state ngoài mirror của storage** | User chọn; chứng minh wiring IPC UI→Background→Storage end-to-end |
| **D9** | Debug Console app: `LogViewer.tsx` (connect port `telemetry.broadcast` qua `openPort`, tail + filter scope/level/traceId) + `StorageInspector.tsx` (gọi IPC `StorageInspect`) + `export-logs.ts` (gom từ LogViewer → Blob JSON download, **không console.log**) | §6.2, OBS-3 (verify E2E Phase 6); port name `telemetry.broadcast` export sẵn từ log-broadcaster |
| **D10** | SidePanel app = menu tĩnh thuần presentation (`menu.ts`): links tới Popup / Debug Console | ui-architecture-conventions §6 — menu tĩnh, không business meta |
| **D11** | Manifest update: `permissions: ['storage', 'alarms', 'sidePanel']`, `action.default_popup` (WXT tự), `side_panel.default_path`, `options_ui` (verify WXT tự sinh — nếu không thì khai function-form) | D2 + sidePanel; permission tối thiểu theo feature thật |
| **D12** | `shared-design-system/` + `shadow-dom/` + `main-world-ui/`: **defer** (0 consumer — popup/debug-console chưa cần primitive dùng chung; shadow-dom cần content entrypoint D5) | YAGNI — tree liệt kê, không có consumer thật trong phase này |
| **D13** | Tests: `tests/unit/1_engine/` (keep-alive schedule logic, session-cache đổ/rehydrate qua mock, message-listener route) + `tests/unit/4_presentation/` (export-logs tạo JSON đúng shape, LogViewer filter thuần) | Architect §7: Vitest test logic điều phối; happy-dom cho component |

## 4. Rủi ro & ứng phó (Reverse Probing — S2)

| # | Rủi ro | Mức | Ứng phó |
|---|---|---|---|
| R1 | G0-04 deny ghi `src/` vì viability-gate chưa có GO Phase 5 | Cao | **T0**: update viability-gate.md trước mọi write |
| R2 | WXT không tự sinh `side_panel`/`options_ui` từ entrypoint HTML → manifest thiếu → sidepanel không mở được | Trung bình | Sau build, đọc `.output/chrome-mv3/manifest.json`; thiếu thì khai tường minh trong manifest function-form (D11) |
| R3 | G1-06 deny message trần ngoài bridge — nhưng bridge scaffold trong 1_engine chính là file được ngoại lệ | Thấp | Code nằm đúng `main-world-bridge.ts` (bridge_file trong rules.yaml); `dom-bridge.ts` không cần ngoại lệ — không gửi message qua bridge |
| R4 | `console.log` trong code UI (export-logs/Debug Console) bị deny | Trung bình | export-logs dùng Blob URL + `URL.createObjectURL` — không console; mọi log qua logger |
| R5 | Popup giữ business state vi phạm ADR-007 (review thủ công) | Trung bình | D8: React state chỉ mirror storage, mọi write qua IPC `SettingsSet`; mở popup luôn fetch lại |
| R6 | Entrypoint content/offscreen khai matches rỗng → manifest invalid | Cao nếu cố | D5/D6: scaffold phi-entrypoint, entrypoint defer Phase 6 — build xanh, manifest valid |
| R7 | `sender` từ UI gửi `SettingsSet` — SIDE_EFFECT mặc định 0 retry → user bấm 2 lần = 2 write trùng | Thấp | Chấp nhận (idempotent set); không đổi contract |
| R8 | keep-alive alarm period 30s → mỗi 0.5 phút ghi storage → vượt ~120 writes/phút | Thấp | Ghi 1 key nhỏ (`session.sw_active_timestamp`) — 2 writes/phút, xa ngưỡng §8 |

## 5. Danh sách task (T0 → T13)

| # | Task | Deliverable |
|---|---|---|
| **T0** | Update `docs/decisions/viability-gate.md` — GO Phase 5 | ✅ GO + scope + cấm mục |
| **T1** | `background/index.ts` bootstrap: Router instance + `registerInfrastructureHandlers` + `registerMessageListener` + lifecycle mount | Background thật, route IPC |
| **T2** | `background/lifecycle/`: `on-installed.ts`, `on-startup.ts`, `keep-alive.ts` | Alarm pattern + init |
| **T3** | `background/listeners/message-listener.ts` (route thuần) + `background/state/session-cache.ts` (chrome.storage.session wrapper) | Route + cache SW |
| **T4** | Content scaffold phi-entrypoint: `isolated-world/dom-bridge.ts`, `main-world-bridge.ts`, `main-world/page-context-hook.ts` | Bridges sẵn sàng Phase 6 |
| **T5** | Offscreen scaffold: `offscreen/handlers/dom-parse-handler.ts` (pure fn + test) | Handler sẵn sàng Phase 6 |
| **T6** | `ui-pages/`: popup, sidepanel, options, debug-console `index.html` | 4 entrypoint HTML |
| **T7** | `extension-views/popup-app/`: App.tsx + settings hooks + open-debug-console | Settings showcase qua IPC |
| **T8** | `extension-views/debug-console-app/`: `LogViewer.tsx` (port tail + filter), `StorageInspector.tsx`, `export-logs.ts` | Cockpit quan sát |
| **T9** | `extension-views/sidepanel-app/`: `menu.ts` + App tĩnh | Menu thuần presentation |
| **T10** | `wxt.config.ts` manifest: permissions + side_panel + options_ui + verify manifest output build | Manifest hợp lệ |
| **T11** | Tests: `tests/unit/1_engine/` (keep-alive, session-cache, message-listener) + `tests/unit/4_presentation/` (export-logs, LogViewer filter) | Logic điều phối + component |
| **T12** | `docs/validation-report.md` — bằng chứng Phase 5 (typecheck/lint/format/test/build/arc1 + manifest JSON + manual smoke popup) | Evidence binary gates |
| **T13** | Commit + merge PR `feat/phase-5-engine-presentation` | — |

**Trình tự verify cuối phase:** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test -- --coverage && pnpm build && pnpm arc1` — toàn bộ xanh + đọc `.output/chrome-mv3/manifest.json` (action/side_panel/options_ui đủ, 0 match secret).

## 6. Bằng chứng (binary gates) — sẽ ghi vào validation-report.md

BASE-0 (typecheck/lint/format) · TST-1 (test --coverage, ngưỡng hiện hành trên 3_modules) · build 0 lỗi + manifest valid · ARC-1 (depcruise xanh với `engine-khong-ngo` mới có nội dung) · CFG-1 (secret scan 0 match).

## 7. Skipped (YAGNI — Zero-Artifact)

- Content/offscreen **entrypoint** `index.ts` + matches thật → Phase 6 (TST-2 E2E cần flow thật)
- `tabs-listener.ts`, `context-menu-listener.ts` → khi có feature dùng tabs/context-menu (cần `contextMenus` permission)
- `shared-design-system/`, `shadow-dom/`, `main-world-ui/` → khi có consumer thật (injected UI cần content entrypoint)
- `options-app` → tree không liệt kê; options = shell tĩnh
- Contract mới trong `0_contracts/` (G0-03) → 4 action hiện có đủ cho settings + telemetry + inspect
- `domain-entities` → chưa có feature xuyên process cần entity
