---
trigger: glob
description: 'Quy chuẩn kiến trúc WXT Chrome Extension MV3: vòng đời Service Worker, engine entrypoints, content worlds, giao tiếp IPC tại dự án Chrome Extension MV3 (WXT)'
globs: ['src/0_contracts/**', 'src/1_engine/**', 'src/2_platform_adapters/ipc/**', 'wxt.config.ts']
---

# 🧩 Rule: WXT Chrome Extension Architecture — Chrome Extension MV3 (WXT)

Rule này tự động kích hoạt khi làm việc với contracts, engine entrypoints, IPC hoặc file cấu hình extension (`wxt.config.ts`).

> ✅ **Trạng thái enforce:** ranh giới `3_modules/` (cấm `chrome`/`document`/`window`), liên lạc Main World chỉ qua `main-world-bridge.ts`, cấm `console.log` trần và `traceId` bắt buộc đã được cơ học hóa thành hooks gate — **G1-06** `gate_arch_boundary.py` (PreToolUse, deny lúc ghi file), **G1-07** `gate_traceid.py` + **G0-03** `gate_contract_lock.py` (backstop traceId, force_ask khi sửa `0_contracts/`). Phần còn lại đánh dấu ⚠️ là rule mềm / ℹ️ kiến thức. Config: `.agent/hooks/scripts/config/rules.yaml` (sections `arch_boundary`, `traceid`); danh sách gate đầy đủ: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md` (§2).

## Mục lục

1. [Lifecycle & Service Worker (MV3)](#1)
2. [Rule "WXT chỉ là Shell"](#2)
3. [Cấu trúc 1_engine/background](#3)
4. [Content Worlds & Offscreen](#4)
5. [Communication Pattern (IPC)](#5)

<a name="1"></a>

## 1. Lifecycle & Service Worker (MV3)

- `1_engine/background/` chạy như một Chrome Manifest V3 Service Worker:
  - **KHÔNG giữ biến state toàn cục trong bộ nhớ lâu dài** — SW bị Chrome kill sau **~30s idle**, state biến mất âm thầm. ⚠️ Còn soft — quy ước kiến trúc, chưa có hook.
  - State phải externalize ra `chrome.storage` (`chrome.storage.session` cho dữ liệu phiên, `local` cho dữ liệu bền). ⚠️ Còn soft — chưa có hook.
  - Runtime code **phải nằm trong hàm `defineBackground()`** — không viết top-level side effects. ⚠️ Còn soft — chưa có hook.
  - ⚠️ DevTools mở sẽ giữ SW sống nhân tạo → bug mất state không tái hiện được khi debug. ℹ️ Kiến thức — không enforce được.
- `1_engine/` là nơi **DUY NHẤT** chứa `defineBackground` / `defineContentScript` — chỉ **Register & Listen**, tuyệt đối không tính toán hay render phức tạp. Business logic nằm ở `3_modules/`. ⚠️ Còn soft — chưa có hook.

<a name="2"></a>

## 2. Rule "WXT chỉ là Shell — Business nằm ở Core TypeScript"

- `1_engine/` chỉ chứa mã bootstrap của WXT (Background SW, Content Scripts, Offscreen, UI pages). **Cấm nhồi business logic vào engine.** ⚠️ Còn soft — chưa có hook.
- `1_engine/ui-pages/` chỉ chứa `index.html` shell (popup/sidepanel/options/debug-console) — UI thật nằm ở `4_presentation/`. ⚠️ Còn soft — chưa có hook.
- `0_contracts/` tuyệt đối không phụ thuộc WXT, React, hay `chrome` APIs — nguồn sự thật duy nhất cho type xuyên process. ⚠️ Còn soft — **G0-03** chỉ force_ask khi sửa `0_contracts/`, chưa check nội dung phụ thuộc.
- `3_modules/` 100% Pure TypeScript — không import `chrome`/`document`/`window`. ✅ Cơ học hóa — Hook **G1-06** `gate_arch_boundary.py` (chrome_regex + dom_regex, deny lúc ghi file).

<a name="3"></a>

## 3. Cấu trúc 1_engine/background

```txt
1_engine/background/
├── index.ts               # Bootstrap: defineBackground, khởi tạo listener
├── lifecycle/
│   ├── on-installed.ts    # chrome.runtime.onInstalled
│   ├── on-startup.ts      # chrome.runtime.onStartup
│   └── keep-alive.ts      # Alarm pattern né idle-kill (~30s)
├── listeners/
│   ├── message-listener.ts     # CHỈ route → IPC Router (Layer 2)
│   ├── tabs-listener.ts
│   ├── alarms-listener.ts
│   └── context-menu-listener.ts
└── state/
    └── session-cache.ts   # chrome.storage.session
```

- `message-listener.ts` chỉ **route** message tới `2_platform_adapters/ipc/router.ts` — không chứa xử lý nghiệp vụ. ⚠️ Còn soft — chưa có hook.
- `keep-alive.ts` dùng Alarm pattern né việc SW bị idle-kill giữa chừng. ℹ️ Kiến thức.

<a name="4"></a>

## 4. Content Worlds & Offscreen

Content Script tách vật lý 2 world vì đây là 2 JS realm khác nhau với quyền hạn đối lập:

- `1_engine/content/isolated-world/` — có `chrome.*` hạn chế (`runtime`, `storage`, `i18n`), đọc/ghi DOM được nhưng **không thấy** biến JS trang, bị CORS/CSP trang chặn. Chứa `dom-bridge.ts` và `main-world-bridge.ts`. ℹ️ Kiến thức.
- `1_engine/content/main-world/` — thấy DOM lẫn biến JS global của trang, **không có `chrome.*`** — mọi liên lạc phải `postMessage` ngược ra Isolated World qua `main-world-bridge.ts` (không postMessage rải rác). ✅ Cơ học hóa — Hook **G1-06** (post_message_regex + bridge_file).
- `1_engine/offscreen/` — tài liệu ẩn, SW mượn khi cần DOM/Audio/Clipboard; quản lý qua `chrome.offscreen`. ℹ️ Kiến thức.
- `1_engine/ui-pages/` — chỉ chứa `index.html` của popup/sidepanel/options/debug-console (UI thật ở `4_presentation/`). ℹ️ Kiến thức.

<a name="5"></a>

## 5. Communication Pattern (IPC)

- **Discriminated Union** tại `0_contracts/ipc-actions.ts` (Enum tên toàn bộ message action) — ℹ️ Kiến thức:

  ```typescript
  export enum IpcAction {
    PageCapture = 'page.capture',
    SettingsGet = 'settings.get',
    // ...
  }
  ```

- Request/Response tại `0_contracts/ipc-payloads.ts` — **`traceId` bắt buộc, không optional** (enforce ở type level, build fail nếu thiếu field). ✅ Cơ học hóa — Hook **G1-07** `gate_traceid.py` (PostToolUse backstop, lọc `traceId?`) + **G0-03** `gate_contract_lock.py` (force_ask khi sửa `0_contracts/`).
- Phản hồi qua message bus theo định dạng **`MessageResponse<T>`** — ℹ️ Kiến thức:

  ```typescript
  type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: AppError };
  ```

- `2_platform_adapters/ipc/sender.ts` — bắt buộc **timeout + retry** (SW "ngủ" → message đầu dễ bị mất, không fail âm thầm). ⚠️ Còn soft — chưa có hook.
- `2_platform_adapters/ipc/port-channel.ts` — long-lived connection cho streaming (log real-time, dữ liệu liên tục). ⚠️ Còn soft — chưa có hook.
- Cấm `console.log` trần ngoài `telemetry/logger.ts` — mọi log gửi lên Log Sink kèm `traceId`. ✅ Cơ học hóa — Hook **G1-06** (console_log_regex, ngoại trừ `telemetry/logger.ts`) + ESLint OBS-1.
