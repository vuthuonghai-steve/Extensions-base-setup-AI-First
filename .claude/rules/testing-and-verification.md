---
trigger: model_decision
description: "Quy chuẩn Testing Pyramid Vitest/Playwright (ADR-005), kỹ thuật Playwright MV3 launchPersistentContext + serviceWorkers, cấu trúc tests/, Binary Gate TST-1/TST-2/OBS-3 + BASE-0/ZPL-1 theo §7, §11 Architect-workspace.md"
globs: ["tests/**", "src/3_modules/**", "src/2_platform_adapters/**", "*.config.ts"]
---

# 🧪 Rule: Testing, Verification & Binary Gate

Rule này quy định chuẩn mực bắt buộc cho LLM Agent trong quá trình kiểm thử và kiểm chứng chất lượng theo **Testing Pyramid** (ADR-005) và **Binary Gate** (§11 của `Architect-workspace.md`). Ràng buộc vật lý của từng context quyết định công cụ test, không phải sở thích.

## 1. Testing Pyramid — Vitest vs Playwright

| Context | Vitest thuần? | Playwright? | Lý do |
|:---|:---|:---|:---|
| `3_modules/` (Pure TS) | ✅ **trực tiếp** | ❌ không cần | Không đụng `chrome.*`/DOM — test thuần, chạy nhanh |
| `2_platform_adapters/` | ⚠️ Vitest + mock `chrome.*` (`@webext-core/fake-browser`) | ❌ | Test logic adapter, không test hành vi Chrome thật |
| `1_engine/background/` | ⚠️ Vitest test logic điều phối qua mock | ✅ cần, test kịch bản **SW restart thật** | Vitest không mô phỏng được vòng đời SW thật |
| `1_engine/content/` | ❌ | ✅ **bắt buộc** | Cần DOM trang thật + Isolated World thật |
| `4_presentation/extension-views` | ✅ test component (props/render) | ✅ test tích hợp thật (click, gọi IPC) | Tách logic hiển thị vs hành vi thật |
| IPC end-to-end (Content→Background→Storage) | ❌ | ✅ **duy nhất** | Luồng xuyên-process chỉ Playwright load extension thật mới verify được |

**Lý do kim tự tháp (ADR-005)**: chỉ Playwright cho mọi thứ → chậm, tốn CI. Vitest phủ Layer 2–3–4 (component) cho CI nhanh; Playwright chỉ phủ Layer 1 + IPC E2E. Đánh đổi chấp nhận: phải duy trì 2 bộ test-runner song song.

## 2. Kỹ thuật Playwright cho MV3

Kiểm chứng cơ học Background thực sự xử lý đúng — **không tin báo cáo của AI Agent**:

```typescript
const context = await chromium.launchPersistentContext(userDataDir, {
  args: [
    '--disable-extensions-except=PATH', // PATH trỏ tới .output/chrome-mv3
    '--load-extension=PATH',
  ],
});
// Lấy handle Service Worker Background để assert log/state trực tiếp
const [sw] = context.serviceWorkers();
await sw.evaluate(() => /* đọc state / trigger handler */);
```

- `launchPersistentContext(userDataDir, ...)`: **bắt buộc** (không dùng `launch` + `newContext`) để extension MV3 được nạp.
- `context.serviceWorkers()`: lấy handle Background SW → assert log/state — **cách duy nhất kiểm chứng cơ học nhị phân** rằng Background xử lý đúng, thay vì tin AI báo cáo.

## 3. Cấu trúc tests/ (theo cây thư mục §4)

```text
tests/
├── unit/                                 # Vitest
│   ├── 3_modules/bookmark-manager.spec.ts
│   └── 2_platform_adapters/storage-driver.spec.ts   # mock qua fake-browser
├── e2e/                                  # Playwright — load extension thật
│   ├── fixtures/extension.fixture.ts
│   ├── flows/
│   │   ├── save-bookmark.e2e.ts
│   │   └── onboarding.e2e.ts
│   └── debug-console.e2e.ts
└── contract/
    └── ipc-payload-shape.spec.ts
```

- **tests/unit/**: Vitest cho `3_modules/` (thuần, không mock — mỗi module 1 spec tại `tests/unit/3_modules/`) và `2_platform_adapters/` (mock `chrome.*` qua `@webext-core/fake-browser`).
- **tests/e2e/**: Playwright load extension build thật; `fixtures/extension.fixture.ts` chứa `launchPersistentContext` + tiện ích lấy `serviceWorkers()`; `flows/*.e2e.ts` là core flow; `debug-console.e2e.ts` verify log trên Debug Console (OBS-3).
- **tests/contract/ipc-payload-shape.spec.ts**: khóa shape IPC payload (field `traceId` bắt buộc — OBS-2) khỏi phá vỡ.
- **Mọi test nằm trong `tests/` — không đặt file test trong `src/`** (đúng cây §4): test ở `src/` sẽ bị instrument vào coverage `src/3_modules/**` (bóp méo %), và 2 pattern cùng pass vì không gate nào enforce vị trí — thống nhất 1 pattern duy nhất tại `tests/`.

## 4. Cổng kiểm chứng chất lượng bắt buộc (Gates)

Mọi thay đổi trước khi hoàn tất phải vượt qua **100% kiểm tra cơ học**, theo thứ tự:

**Gate tiền đề:**
- **BASE-0** — `npm run typecheck` + `npm run lint`: **0 lỗi** (type + lint) trước khi chạy bất kỳ test nào.
- **ZPL-1** — Zero Placeholder scan: **0 placeholder** ("tạm", hardcode giá trị giả, TODO test) trong diff.

**Gate bắt buộc (§11):**
- **TST-1** — Mỗi use-case trong `3_modules/composite-modules/` có Vitest coverage; coverage report đạt ngưỡng đã thống nhất trên `3_modules/`.
- **TST-2** — Mỗi core flow có **≥1 Playwright E2E** chạy trên extension build thật; CI load unpacked extension, chạy flow, pass xanh.
- **OBS-3** — Debug Console Page export log JSON hoạt động: Playwright test verify log xuất hiện **đúng traceId** sau khi giả lập hành vi.

**Trình tự chạy**: `npm run typecheck && npm run lint` (BASE-0) → `npm run test` (TST-1) → `npm run build` (bundle `.output/chrome-mv3` 0 lỗi) → `npm run test:e2e` (TST-2, OBS-3).

## 5. Self-Debugging Loop

Khi xảy ra lỗi compile hoặc test thất bại:
1. Đọc log từ **Debug Console Page** (tail real-time) hoặc **export JSON** (`export-logs.ts`), hoặc terminal traceback.
2. Trích xuất chính xác `file_line` và `decision_reason` trong LogEntry gây lỗi.
3. Thực hiện chu trình tự sửa lỗi (< 3s RCA).
4. Re-run gate: `npm run typecheck && npm run lint && npm run test` (thêm `npm run test:e2e` nếu đổi hành vi runtime) để xác nhận thành công.

## 6. Nguyên tắc bất biến

- **CẤM báo cáo kết quả dựa trên giả định** — không được tuyên bố "tính năng đã hoạt động" hoặc "đã fix thành công" nếu chưa qua **kiểm chứng cơ học nhị phân** (gate CI xanh / log thực tế từ Debug Console / assert từ `serviceWorkers()` handle).
