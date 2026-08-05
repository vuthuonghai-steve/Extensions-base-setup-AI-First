Dựa trên kiến trúc Clean Architecture & Manifest V3 của dự án được quy định trong [Architect-workspace.md](file:///home/stveve/Documents/workspace/Steve/Setup-project/Extensions/Docs/Setups/Architect-workspace/Architect-workspace.md), để triển khai dự án một cách chặt chẽ, không bị lỗi phụ thuộc vòng (circular dependency) hay gãy type khi phát triển, việc setup nên chia thành **6 giai đoạn theo nguyên tắc Bottom-Up (từ dưới lên trên theo luồng phụ thuộc)**:

---

### **Giai đoạn 1: Infrastructure & Base Configuration (Hạ tầng & Cấu hình cơ sở)**

- **Nhiệm vụ**:
  - Setup WXT configuration (`wxt.config.ts`), `package.json` dependencies, TypeScript config (`tsconfig.json`), ESLint/Prettier rules (đặc biệt là rule cấm `console.log` trần).
  - Setup Zod Schema cho cấu hình môi trường (`config-schema.ts`) và các tệp `.env.development`, `.env.staging`, `.env.production`.
- **Vì sao**: Cần đảm bảo môi trường build, bundler, module aliases (`@/`), type-checking và linter hoạt động chuẩn xác 100% trước khi viết bất kỳ dòng code nguồn nào. Tránh việc phát triển xong mới phát hiện lỗi môi trường hoặc thiếu biến `.env` bắt buộc.
- **✅ Hoàn tất (2026-08-05, commit `7f525d6`)** — theo `Docs/Setups/phase-1-setup-plan.md` T0→T10: typecheck/lint/test/build/arc1/format đều xanh; CFG-2 negative test có bằng chứng (build đỏ khi thiếu `WXT_APP_NAME`); CFG-1 scan 0 match secret trong `dist/`.

---

### **Giai đoạn 2: Layer 0 — Contracts & Core Types (Nguồn sự thật)**

- **Nhiệm vụ**: Dựng toàn bộ các định nghĩa trong `src/0_contracts/`:
  - `ipc-actions.ts` (Enum danh sách action tên message IPC).
  - `ipc-payloads.ts` (Type Request/Response + đính kèm bắt buộc `traceId`).
  - `storage-schema.ts` (Type cho từng key trong `chrome.storage`).
  - `domain-entities.ts` (Thực thể nghiệp vụ thuần như Bookmark, User...).
  - `log-schema.ts` (Schema cho LogEntry).
- **Vì sao**: **Layer 0 hoàn toàn độc lập, không phụ thuộc vào bất kỳ tầng nào khác.** Trong môi trường MV3, Background, Content Script, và Popup chạy trên 3 tiến trình vật lý riêng biệt. Đĩnh nghĩa Layer 0 trước đảm bảo "Nguồn sự thật duy nhất" (Single Source of Truth), giúp kiểm soát Type-safety xuyên process ngay từ đầu.
- **✅ Hoàn tất (2026-08-05, merged PR #2 + commit `fc7d6ac`)**: toàn bộ `src/0_contracts/` (`ipc-actions.ts`, `ipc-payloads.ts`, `storage-schema.ts`, `domain-entities` qua `index.ts`, `log-schema.ts`, `config-schema.ts`) + review findings (tighten storage key types, OBS-2 lock `traceId` bắt buộc ở type level).

---

### **Giai đoạn 3: Layer 2 — Platform Adapters & Cross-cutting Services (Bọc API Native & Telemetry)**

- **Nhiệm vụ**:
  - Implement hệ thống **Telemetry & Logging tập trung** (`telemetry/`: `logger.ts`, `log-sink.ts`, `log-ring-buffer.ts`, `trace-id.ts`).
  - Implement các adapter bọc API native `chrome.*` (`storage/`, `ipc/` Router & Sender, `tabs/`, `scripting/`, `permissions/`...).
- **Vì sao**:
  1. Trình duyệt Chrome phân mảnh log ở nhiều nơi và Service Worker có thể bị OS kill bất kỳ lúc nào. Cần có sẵn hạ tầng Telemetry/Logger để bắt log và trace bug ở tất cả các bước tiếp theo.
  2. Việc bọc toàn bộ `chrome.*` API thành Adapter giúp cách ly dependency của Chrome, cho phép mock dễ dàng ở Layer 3 phía trên.

---

### **Giai đoạn 4: Layer 3 — Pure Modules & Unit Testing (Xử lý nghiệp vụ thuần)**

- **Nhiệm vụ**:
  - Implement các `sub-modules/` (Pure TypeScript helpers: `time-formatter`, `dom-parser`, `ai-stream-decoder`...).
  - Implement các `composite-modules/` (Logic nghiệp vụ chính: `bookmark-manager`, các `use-cases/...`).
  - Viết Unit Test độc lập bằng **Vitest** trong `tests/unit/`.
- **Vì sao**: Layer 3 là "trái tim" xử lý logic nghiệp vụ. Vì 100% code ở đây là **Pure TypeScript** (không import `chrome`, không đụng DOM `document`/`window`), ta có thể viết và kiểm thử nhanh chóng bằng Vitest thông qua mock của Layer 2 mà không cần khởi động Chrome thật.

---

### **Giai đoạn 5: Layer 1 — Engine Entrypoints & Layer 4 — Presentation (Tích hợp & Giao diện)**

- **Nhiệm vụ**:
  - **Layer 1 (Engine)**: Khởi tạo các điểm vào WXT (`background/index.ts`, `content/isolated-world`, `main-world`, `offscreen`, các `listeners` và `lifecycle`). Route các IPC message vào Router Layer 2.
  - **Layer 4 (Presentation)**: Dựng UI cho Extension Surfaces (`popup-app`, `sidepanel-app`, `debug-console-app`) và Shadow DOM Injected UI (`mount-point.ts`).
- **Vì sao**: Tầng Engine và Presentation đóng vai trò "lắp ráp" (wiring). Lúc này, mọi hợp đồng (Contracts), công cụ (Adapters), logic nghiệp vụ (Modules) và công cụ quan sát (Telemetry) đều đã sẵn sàng và đã qua unit test. Tầng 1 và 4 chỉ cần đăng ký sự kiện, chuyển tiếp dữ liệu và hiển thị UI.

---

### **Giai đoạn 6: E2E Testing & System Verification (Kiểm thử hệ thống toàn diện)**

- **Nhiệm vụ**:
  - Cấu hình **Playwright** để tự động hóa việc build và load Extension thật (`chromium.launchPersistentContext` với `--load-extension`).
  - Viết E2E tests trong `tests/e2e/` (luồng lưu bookmark, onboarding, kiểm tra real-time log trên Debug Console app).
- **Vì sao**: Môi trường Manifest V3 có các kịch bản thực tế mà mock/Vitest không thể mô phỏng hết (Service Worker bị idle-kill, ranh giới an toàn giữa Isolated World và Main World, IPC streaming). Chạy E2E test trên trình duyệt thật ở giai đoạn cuối là bước nghiệm thu đảm bảo hệ thống vận hành đúng kiến trúc và đạt độ bền tuyệt đối.

---

### **Phụ lục: Trạng thái CI tự động (2026-08-05, merge `ci/github-actions`)**

- ✅ `.github/workflows/ci.yml` **đã active** cho `pull_request` + `push` main, gồm các gate: **BASE-0** (typecheck, lint, format:check), **TST-1** (`pnpm test` — Vitest), **CFG-2** (`pnpm build` — fail cứng khi thiếu biến `.env` bắt buộc), **ARC-1** (`pnpm arc1` — depcruise), **CFG-1** (secret scan regex trong `.output/` — bản CI của hook G1-08).
- ⏸ Job `e2e` **đã viết sẵn nhưng đang `if: false`** — chờ giai đoạn 6.
- **Còn thiếu để hoàn thiện** (làm ở giai đoạn 6, sau khi có Layer 1 + Layer 4):
  - `playwright.config.ts` + `tests/e2e/` + fixture `extension.fixture.ts` (`launchPersistentContext` + `context.serviceWorkers()` — theo testing-and-verification.md §2).
  - Bật job `e2e` trong `ci.yml` (bỏ `if: false`).
  - **OBS-3**: Playwright verify log xuất hiện đúng `traceId` trên Debug Console.
  - **TST-1 coverage**: hiện chỉ `vitest run` không `--coverage` — cần config coverage report ngưỡng trên `3_modules/`.

---
