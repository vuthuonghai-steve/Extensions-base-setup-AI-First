# Kiến trúc Nền tảng Chrome Extension (Manifest V3) — Tài liệu Hợp nhất

---

## Mục lục

1. [Domain Anchoring — Vì sao kiến trúc này tồn tại](#1)
2. [Cơ chế tầng đáy: Ma trận Execution Context](#2)
3. [Sơ đồ Kiến trúc Phân tầng tổng thể](#3)
4. [Cây thư mục dự án đầy đủ](#4)
5. [Giải thích chi tiết từng Layer](#5)
6. [Layer xuyên suốt: Telemetry (Log/Debug) & Config](#6)
7. [Chiến lược Test: Vitest vs Playwright](#7)
8. [Ma trận Quyền hạn Context](#8)
9. [Quy tắc phụ thuộc & Luồng dữ liệu](#9)
10. [Bảng Trade-off & Quyết định Kiến trúc (ADR tổng hợp)](#10)
11. [Binary Gate — Checklist nghiệm thu cơ học](#11)
12. [Quy trình giao task cho AI Agent](#12)

---

<a name="1"></a>

## 1. Domain Anchoring — Vì sao kiến trúc này tồn tại

### 1.1 Bài toán gốc

Bạn chuyển từ mental model **Next.js/Node.js** (1 tiến trình, tuyến tính, server sống liên tục) sang **Chrome Extension MV3** (đa tiến trình song song, độc lập, giao tiếp bất đồng bộ, vòng đời không chắc chắn). Đây không phải là "học thêm API mới" mà là **thay đổi mô hình tư duy về hệ thống phân tán thu nhỏ trong trình duyệt**.

### 1.2 Khác biệt bản chất

| Khía cạnh        | Next.js/Node.js                        | Chrome Extension MV3                                                             |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Mô hình thực thi | 1 process, request/response tuyến tính | Đa tiến trình song song, giao tiếp qua message bất đồng bộ                       |
| Vòng đời         | Server sống liên tục                   | Service Worker **bị Chrome random kill sau ~30s idle**, không đảm bảo sống       |
| State            | Giữ trong memory thoải mái             | Không tin memory SW — phải externalize ra `chrome.storage`                       |
| DOM              | Server không có, Client có full        | 3 quan hệ DOM khác nhau tùy context                                              |
| Bảo mật          | CORS server tự quyết                   | CSP MV3 chặn cứng eval/inline script; bundle luôn public, không giấu được secret |
| Debug            | 1 nguồn log (terminal/browser console) | Log phân mảnh theo 3+ process khác nhau                                          |

### 1.3 Reverse Probing — 5 nguyên nhân khiến kiến trúc/dự án thất bại nếu bỏ qua

1. AI Agent giả định biến toàn cục trong Background sống mãi → SW bị kill giữa chừng → **mất state âm thầm**, bug không tái hiện được vì DevTools mở sẽ giữ SW sống nhân tạo (che giấu bug khi bạn debug).
2. AI nhầm Content Script đọc được biến JS của trang (`window.__NEXT_DATA__`...) → **Isolated World không share JS runtime** với trang, chỉ share DOM node.
3. AI import `chrome.*` thẳng vào logic nghiệp vụ → module **vĩnh viễn không unit-test được**, không tái dùng giữa các context.
4. AI dùng `innerHTML` chèn `<script>`/`eval()` → **bị CSP MV3 chặn cứng**, extension bị Chrome Web Store từ chối duyệt.
5. Message passing không timeout/retry → khi SW "ngủ", message đầu bị mất, fail âm thầm không throw lỗi rõ ràng.

### 1.4 Stakeholder Map

| Bên liên quan                     | Vai trò                            | Điều cần được đảm bảo                                            |
| --------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Bạn (Architect/Client nghiệm thu) | Ra đề, duyệt kiến trúc, nghiệm thu | Kiến trúc đủ rõ để review code AI mà không cần đọc từng dòng     |
| AI Agent (Coder/Executor)         | Viết code theo contract đã khóa    | Biết chính xác mình đang ở layer/context nào, giới hạn quyền gì  |
| Người dùng cuối                   | Dùng extension                     | Trải nghiệm ổn định, không mất dữ liệu khi SW restart            |
| Chrome Web Store (gatekeeper)     | Duyệt publish                      | Tuân thủ CSP, permission tối thiểu, không secret lộ trong bundle |

---

<a name="2"></a>

## 2. Cơ chế tầng đáy: Ma trận Execution Context

Đây là "luật vật lý" của nền tảng — tương đương việc hiểu Event Loop khi học Node.js. Mọi quyết định kiến trúc phía sau đều là hệ quả trực tiếp của bảng này.

| Context                                           | Process/Realm                            | Vòng đời                                                             | Quan hệ DOM trang                                         | `chrome.*` API                                                      | Network (CORS)            | State qua restart?            |
| ------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------- | ----------------------------- |
| **Background Service Worker**                     | Riêng, không UI                          | Event-driven, Chrome tự kill sau ~30s idle, tối đa ~5 phút dù active | Không có DOM (`document` không tồn tại)                   | Đầy đủ nhất                                                         | Bypass CORS hoàn toàn     | ❌ phải dùng `chrome.storage` |
| **Content Script – Isolated World**               | JS realm riêng, share DOM node với trang | Theo vòng đời tab/frame                                              | Đọc/ghi DOM được, **không thấy** biến JS global của trang | Hạn chế (`runtime`, `storage`, `i18n`)                              | ❌ Bị CORS/CSP trang chặn | ❌                            |
| **Content Script – Main World** (`world: "MAIN"`) | Chung JS realm với trang                 | Theo tab                                                             | Thấy DOM lẫn biến JS global của trang                     | ❌ Không có `chrome.*` — phải `postMessage` ngược ra Isolated World | ❌                        | ❌                            |
| **Popup / Options / SidePanel**                   | Trang HTML riêng                         | Popup: chết ngay khi mất focus. SidePanel/Options: sống lâu hơn      | DOM riêng, không đụng trang web                           | Đầy đủ                                                              | Bypass CORS               | ❌ trừ khi tự lưu             |
| **Offscreen Document**                            | Ẩn, SW mượn khi cần DOM/Audio/Clipboard  | Tự quản lý qua `chrome.offscreen`                                    | Có DOM đầy đủ                                             | Đầy đủ                                                              | Bypass CORS               | ❌                            |

### Hệ quả kiến trúc trực tiếp

- SW không đáng tin về state → cần **State Persistence Layer** riêng biệt, không chỉ storage adapter chung chung.
- 2 "world" khác nhau trong Content Script → cây thư mục **tách vật lý** `main-world/` và `isolated-world/`.
- Popup chết bất cứ lúc nào → Popup **không được giữ business state**, chỉ là cửa sổ xem state thật nằm ở storage.
- Bundle luôn public → **không có server-side secret** trong extension.

---

<a name="3"></a>

## 3. Sơ đồ Kiến trúc Phân tầng tổng thể

```
┌───────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: PRESENTATION / UI SYSTEM                  │
│  (Extension Pages: Popup, SidePanel, Debug Console | Shadow DOM UI)   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Component Props & Events
┌───────────────────────────────▼─────────────────────────────────────────┐
│              LAYER 3: CORE BUSINESS MODULES (Pure TypeScript)         │
│         KHÔNG gọi chrome.* trực tiếp — 100% test được bằng Vitest     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Invokes qua interface
┌───────────────────────────────▼─────────────────────────────────────────┐
│      LAYER 2: PLATFORM ADAPTERS & IPC ROUTER (bọc chrome.* 1-1)       │
│   Storage · Tabs · Scripting · Declarative-Net · Telemetry · Config   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Direct Binding
┌───────────────────────────────▼─────────────────────────────────────────┐
│           LAYER 1: MANIFEST V3 ENGINE ENTRYPOINTS (WXT)               │
│  Background(SW) │ Content(Isolated/Main) │ Offscreen │ Extension UI   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│      LAYER 0: CONTRACTS (Type/Schema — nguồn sự thật duy nhất)        │
│         IPC Actions/Payloads · Storage Schema · Domain Entities        │
└───────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc dòng chảy phụ thuộc**: mũi tên chỉ hướng "ai được import ai" — Layer 0 không phụ thuộc gì, Layer 4 phụ thuộc mọi thứ bên dưới. Không bao giờ đi ngược.

---

<a name="4"></a>

## 4. Cây thư mục dự án đầy đủ

```text
my-wxt-extension/
├── wxt.config.ts
├── package.json
├── .env.development
├── .env.staging
├── .env.production
│
├── src/
│   ├── 0_contracts/                          # LAYER 0 — nguồn sự thật, không phụ thuộc ai
│   │   ├── ipc-actions.ts                    # Enum tên toàn bộ message action
│   │   ├── ipc-payloads.ts                   # Type Request/Response, traceId BẮT BUỘC
│   │   ├── storage-schema.ts                 # Type cho từng key trong chrome.storage
│   │   ├── domain-entities.ts                # Type nghiệp vụ thuần (Bookmark, User...)
│   │   ├── log-schema.ts                     # Type LogEntry
│   │   └── config-schema.ts                  # Zod schema validate .env lúc build
│   │
│   ├── 1_engine/                             # LAYER 1 — chỉ Register & Listen
│   │   ├── background/
│   │   │   ├── index.ts                      # Bootstrap
│   │   │   ├── lifecycle/
│   │   │   │   ├── on-installed.ts
│   │   │   │   ├── on-startup.ts
│   │   │   │   └── keep-alive.ts             # Alarm pattern né idle-kill
│   │   │   ├── listeners/
│   │   │   │   ├── message-listener.ts       # Chỉ route → Layer 2 IPC Router
│   │   │   │   ├── tabs-listener.ts
│   │   │   │   ├── alarms-listener.ts
│   │   │   │   └── context-menu-listener.ts
│   │   │   └── state/
│   │   │       └── session-cache.ts          # chrome.storage.session
│   │   │
│   │   ├── content/
│   │   │   ├── isolated-world/               # có chrome.*, KHÔNG thấy JS trang
│   │   │   │   ├── index.ts
│   │   │   │   ├── dom-bridge.ts
│   │   │   │   └── main-world-bridge.ts
│   │   │   └── main-world/                   # thấy JS trang, KHÔNG có chrome.*
│   │   │       └── page-context-hook.ts
│   │   │
│   │   ├── offscreen/
│   │   │   ├── index.ts
│   │   │   └── handlers/
│   │   │       └── dom-parse-handler.ts
│   │   │
│   │   └── ui-pages/
│   │       ├── popup/index.html
│   │       ├── sidepanel/index.html
│   │       ├── options/index.html
│   │       └── debug-console/index.html      # cockpit quan sát toàn hệ thống
│   │
│   ├── 2_platform_adapters/                  # LAYER 2 — bọc chrome.* 1-1
│   │   ├── ipc/
│   │   │   ├── router.ts
│   │   │   ├── sender.ts                     # timeout + retry
│   │   │   └── port-channel.ts               # long-lived connection (streaming)
│   │   ├── storage/
│   │   │   ├── local-driver.ts
│   │   │   ├── sync-driver.ts
│   │   │   └── session-driver.ts
│   │   ├── tabs/tabs-adapter.ts
│   │   ├── scripting/
│   │   │   ├── inject-isolated.ts
│   │   │   └── inject-main.ts
│   │   ├── declarative-net/rules-adapter.ts
│   │   ├── permissions/optional-permissions-adapter.ts
│   │   ├── telemetry/                        # cross-cutting: log & trace
│   │   │   ├── logger.ts
│   │   │   ├── log-sink.ts
│   │   │   ├── log-ring-buffer.ts
│   │   │   ├── trace-id.ts
│   │   │   └── log-broadcaster.ts
│   │   └── config/                           # cross-cutting: cấu hình
│   │       ├── build-config.ts
│   │       └── runtime-config-adapter.ts
│   │
│   ├── 3_modules/                            # LAYER 3 — 100% Pure TypeScript
│   │   ├── sub-modules/
│   │   │   ├── time-formatter/
│   │   │   ├── dom-parser/
│   │   │   └── ai-stream-decoder/
│   │   └── composite-modules/
│   │       └── bookmark-manager/
│   │           ├── index.ts
│   │           ├── use-cases/
│   │           │   ├── save-bookmark.ts
│   │           │   └── delete-bookmark.ts
│   │           └── bookmark-manager.test.ts
│   │
│   └── 4_presentation/                       # LAYER 4
│       ├── main-world-ui/
│       ├── shadow-dom/
│       │   ├── mount-point.ts
│       │   └── InjectedButton.tsx
│       ├── extension-views/
│       │   ├── popup-app/
│       │   ├── sidepanel-app/
│       │   └── debug-console-app/
│       │       ├── LogViewer.tsx
│       │       ├── StorageInspector.tsx
│       │       └── export-logs.ts
│       └── shared-design-system/
│
└── tests/
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

---

<a name="5"></a>

## 5. Giải thích chi tiết từng Layer

### Layer 0 — Contracts

Nguồn sự thật duy nhất cho type xuyên process. Vì Background/Content/Popup là 3 tiến trình riêng chỉ giao tiếp qua JSON tuần tự hóa, sai type ở một đầu sẽ fail âm thầm ở đầu kia — không có compile-time check xuyên process nếu không tập trung type tại đây.

### Layer 1 — Engine Entrypoints

Nơi duy nhất chứa hàm khởi tạo của WXT (`defineBackground`, `defineContentScript`). Chỉ **Đăng ký** và **Lắng nghe**, tuyệt đối không tính toán hay render phức tạp. Content Script tách vật lý `isolated-world/` và `main-world/` vì đây là 2 JS realm khác nhau với quyền hạn đối lập nhau (xem Ma trận mục 2).

### Layer 2 — Platform Adapters

Tách biệt hoàn toàn API native `chrome.*` khỏi logic nghiệp vụ. Nhờ vậy Layer 3 phía trên mock được adapter để unit test mà không cần mở Chrome thật. `telemetry/` và `config/` nằm ở đây vì bản thân chúng cũng cần bọc `chrome.storage`/`chrome.runtime`.

### Layer 3 — Pure Modules

Trái tim xử lý logic. Quy tắc vàng: **100% Pure TypeScript**, không `import chrome`, không `document`/`window`. Sub-module cung cấp hàm đơn nhiệm; Composite Module ghép sub-module + gọi Layer 2 qua interface để hoàn thành một luồng nghiệp vụ.

### Layer 4 — Presentation

Hai thế giới UI tách biệt: UI trên Extension Surfaces (Popup/SidePanel — React SPA thông thường) và UI Inject vào trang web (bắt buộc qua Shadow DOM để cô lập CSS, tránh trang đích phá giao diện extension).

---

<a name="6"></a>

## 6. Layer xuyên suốt: Telemetry (Log/Debug) & Config

### 6.1 Vì sao log khó nắm bắt — nguyên nhân gốc

1. Log phân mảnh vật lý theo process: SW log ở `chrome://extensions` → Inspect, Content Script log lẫn trong DevTools của chính trang đích, Popup log mất ngay khi đóng popup.
2. SW bị kill → log của quá trình xử lý ngầm biến mất nếu không mở sẵn DevTools.
3. Không có Trace/Correlation ID → không ghép được log rời rạc 3 tầng thành 1 câu chuyện nhân-quả.
4. AI Agent không tự mở trình duyệt quan sát log như người → cần cơ chế xuất log ra JSON đọc được.

### 6.2 Kiến trúc Logging tập trung

```
Content(Isolated) ─┐
Content(MainWorld)─┤
Popup/SidePanel    ─┼─► logger.ts (mỗi context) ─► IPC "LOG_SINK" ─► Background
Offscreen          ─┤
Background chính   ─┘
                                                          │
                                          Ring Buffer (chrome.storage.session, cap N dòng)
                                                          │
                                          Broadcast qua Port → Debug Console Page
                                          (tail real-time, filter theo context/level/traceId, export JSON)
```

**Quy tắc bắt buộc:**

- Cấm `console.log` trần trong `src/` (trừ chính `logger.ts`) — chặn bằng ESLint rule trong CI.
- Mọi `MessageBus.send()` bắt buộc đính kèm `traceId` — enforce ở type level (field bắt buộc, không optional) trong `0_contracts/ipc-payloads.ts`.
- `logger.ts` luôn ghi đồng thời ra console gốc của context (debug F12 truyền thống vẫn dùng được) **và** gửi lên Log Sink.

### 6.3 Kiến trúc Config — ràng buộc bảo mật tiên quyết

> Bundle extension luôn public, không có "server-side secret" — bất kỳ ai cũng unpack và đọc plaintext file `.js`. Đây là giới hạn vật lý, không phải best-practice tùy chọn.

| Loại config                                | Nơi lưu đúng                                                      | Lý do                                           |
| ------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------- |
| Config public (feature flag, endpoint URL) | `.env` build-time qua `import.meta.env`                           | Không nhạy cảm                                  |
| API key bên thứ 3 (bạn trả tiền)           | ❌ Không bao giờ trong extension — bắt buộc Backend Proxy giữ key | Nhét vào = phát key miễn phí cho mọi người dùng |
| Token của chính người dùng (họ tự nhập)    | `chrome.storage.local`, encrypt nếu cần                           | Runtime config, khác biến build-time            |
| Config runtime người dùng chỉnh            | `chrome.storage.sync`/`local`                                     | Preference, không phải secret                   |

Build script **fail cứng** nếu thiếu biến `.env` bắt buộc theo `config-schema.ts` — không cho phép AI Agent tự hardcode giá trị "tạm" (vi phạm Zero Placeholder).

---

<a name="7"></a>

## 7. Chiến lược Test: Vitest vs Playwright

Ràng buộc vật lý quyết định công cụ, không phải sở thích:

| Context                                     | Vitest thuần?                                           | Playwright?                            | Lý do                                                                  |
| ------------------------------------------- | ------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `3_modules/` (Pure TS)                      | ✅ trực tiếp                                            | ❌ không cần                           | Không đụng `chrome.*`/DOM                                              |
| `2_platform_adapters/`                      | ⚠️ cần mock `chrome.*` (vd `@webext-core/fake-browser`) | ❌                                     | Test logic adapter, không test hành vi Chrome thật                     |
| `1_engine/background/`                      | ⚠️ chỉ test logic điều phối qua mock                    | ✅ cần, test kịch bản SW restart thật  | Vitest không mô phỏng được vòng đời SW thật                            |
| `1_engine/content/`                         | ❌                                                      | ✅ bắt buộc                            | Cần DOM trang thật + Isolated World thật                               |
| `4_presentation/extension-views`            | ✅ test component (props/render)                        | ✅ test tích hợp thật (click, gọi IPC) | Tách logic hiển thị vs hành vi thật                                    |
| IPC end-to-end (Content→Background→Storage) | ❌                                                      | ✅ duy nhất                            | Luồng xuyên-process chỉ Playwright load extension thật mới verify được |

**Kỹ thuật Playwright cho MV3**: `chromium.launchPersistentContext(userDataDir, { args: ['--disable-extensions-except=PATH', '--load-extension=PATH'] })`, sau đó `context.serviceWorkers()` để lấy handle Background và assert trực tiếp log/state — cách duy nhất kiểm chứng cơ học rằng Background thực sự xử lý đúng, thay vì tin AI Agent báo cáo.

---

<a name="8"></a>

## 8. Ma trận Quyền hạn Context

| Tầng/Context                | DOM trang web           | `chrome.*` API | External API (CORS) | Render React UI   |
| --------------------------- | ----------------------- | -------------- | ------------------- | ----------------- |
| Background Script           | ❌                      | ✅ Đầy đủ      | ✅ Bypass CORS      | ❌                |
| Content Script (Isolated)   | ✅ Trực tiếp            | ⚠️ Hạn chế     | ❌ Bị chặn          | ✅ qua Shadow DOM |
| Content Script (Main World) | ✅ + thấy biến JS trang | ❌             | ❌                  | ⚠️ Hiếm dùng      |
| Popup/SidePanel             | ❌ (chỉ DOM riêng)      | ✅ Đầy đủ      | ✅ Bypass CORS      | ✅ Trực tiếp      |
| Offscreen Document          | ❌ (DOM riêng, ẩn)      | ✅ Đầy đủ      | ✅ Bypass CORS      | ⚠️ Nếu cần        |
| Layer 3 (Pure Modules)      | ❌                      | ❌             | ❌ (qua Adapter)    | ❌                |

---

<a name="9"></a>

## 9. Quy tắc phụ thuộc & Luồng dữ liệu

```
0_contracts/  ◄── không phụ thuộc ai
     ▲
2_platform_adapters/ (gồm telemetry/, config/)  ◄── chỉ phụ thuộc 0_contracts
     ▲
3_modules/  ◄── phụ thuộc 0_contracts + gọi 2 qua interface, KHÔNG import chrome trực tiếp
     ▲
1_engine/ & 4_presentation/  ◄── lắp ráp mọi thứ lại
```

Quy tắc cứng (enforce bằng lint/CI, không phải tự giác):

- File trong `1_engine/` chỉ import từ `2_platform_adapters/` và `0_contracts/` — không bao giờ import thẳng logic phức tạp của `3_modules/` mà không qua router.
- File trong `3_modules/` cấm import bất cứ gì từ `1_engine/` hoặc `2_platform_adapters/`.
- Giao tiếp Isolated World ↔ Main World chỉ qua `main-world-bridge.ts`, không `postMessage` rải rác.
- `telemetry/` và `config/` là **cross-cutting concern** — không phải Layer 5 đứng trên Layer 4, mà nằm vật lý trong Layer 2 vì đều bọc `chrome.*`, được mọi layer khác import dùng.

---

<a name="10"></a>

## 10. Bảng Trade-off & Quyết định Kiến trúc (ADR tổng hợp)

| ADR         | Vấn đề / Constraint                                                     | Phương án cân nhắc                                                                                                                          | Quyết định                                             | Đánh đổi chấp nhận                                                                                    |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **ADR-001** | Cần đọc biến JS nội bộ trang (vd YouTube player state)                  | (a) Chỉ DOM scraping từ Isolated World — chậm, dễ vỡ khi trang đổi UI. (b) Main World injection                                             | (b)                                                    | Thêm 1 lớp `postMessage` bridge; Main World không được gọi `chrome.storage` trực tiếp                 |
| **ADR-002** | 3 process giao tiếp qua JSON, không có compile-time check xuyên process | (a) Type rải rác từng module. (b) Tập trung `0_contracts/`                                                                                  | (b)                                                    | Thêm bước import chung, nhưng đổi lại an toàn type xuyên process                                      |
| **ADR-003** | SW có thể bị kill giữa xử lý, log biến mất                              | (a) Chỉ dựa console.log từng context. (b) Log Sink tập trung + Ring Buffer persist                                                          | (b)                                                    | Thêm overhead mỗi log phải qua IPC; đổi lại có "cockpit" quan sát toàn cảnh                           |
| **ADR-004** | Bundle luôn public, không giấu được secret                              | (a) Nhét key thẳng vào .env build. (b) Backend Proxy giữ key bên thứ 3                                                                      | (b) cho key trả phí; (a) chỉ cho config không nhạy cảm | Cần thêm 1 service backend, tăng độ phức tạp hạ tầng nhưng bắt buộc về bảo mật                        |
| **ADR-005** | Test đa context, chi phí thời gian chạy CI                              | (a) Chỉ Playwright cho mọi thứ (chậm, tốn CI). (b) Testing Pyramid: Vitest phủ Layer 2–3–4(component), Playwright chỉ phủ Layer 1 + IPC E2E | (b)                                                    | Cần duy trì 2 bộ test-runner song song, nhưng CI nhanh hơn nhiều so với toàn Playwright               |
| **ADR-006** | AI Agent dễ viết code sai layer/context nếu không có rào cản cơ học     | (a) Review bằng mắt mỗi PR. (b) ESLint custom rule + Binary Gate chặn merge                                                                 | (b)                                                    | Tốn công thiết lập rule ban đầu, đổi lại loại bỏ hoàn toàn lớp lỗi do "AI tiện tay"                   |
| **ADR-007** | Popup có thể chết bất cứ lúc nào khi mất focus                          | (a) Giữ state nghiệp vụ trong React state của Popup. (b) Popup chỉ là view, state thật nằm `chrome.storage`                                 | (b)                                                    | Mỗi lần mở popup phải fetch lại state (độ trễ nhỏ), đổi lại không mất dữ liệu khi popup đóng đột ngột |

---

<a name="11"></a>

## 11. Binary Gate — Checklist nghiệm thu cơ học

Bổ sung cho Stage 5 (Build & Quality) của quy trình 8 giai đoạn, các gate sau là **bắt buộc pass** trước khi merge:

```yaml
- id: 'OBS-1'
  item: 'Không có console.log trần ngoài telemetry/logger.ts'
  pass: 'ESLint rule chạy CI, 0 vi phạm'

- id: 'OBS-2'
  item: 'Mọi IPC message mang traceId'
  pass: 'Type-level bắt buộc ở 0_contracts, build fail nếu thiếu field'

- id: 'OBS-3'
  item: 'Debug Console Page export log JSON hoạt động'
  pass: 'Playwright test verify log xuất hiện đúng traceId sau khi giả lập hành vi'

- id: 'CFG-1'
  item: 'Không có API key bên thứ 3 trong dist/ sau build'
  pass: 'Script scan regex (sk-, AIza...) trong dist/ — 0 match'

- id: 'CFG-2'
  item: 'Build fail cứng khi thiếu biến .env bắt buộc'
  pass: 'CI chạy build với .env cố ý thiếu 1 biến → build đỏ'

- id: 'TST-1'
  item: 'Mỗi use-case trong composite-modules có Vitest coverage'
  pass: 'Coverage report đạt ngưỡng đã thống nhất trên 3_modules/'

- id: 'TST-2'
  item: 'Mỗi core flow có ≥1 Playwright E2E chạy trên extension build thật'
  pass: 'CI load unpacked extension, chạy flow, pass xanh'

- id: 'ARC-1'
  item: 'Không có import ngược chiều (Layer thấp import Layer cao)'
  pass: 'Lint rule dependency-cruiser hoặc tương đương, CI xanh'

- id: 'ARC-2'
  item: '3_modules/ không import chrome/document/window'
  pass: 'Static scan, 0 match'
```

---

<a name="12"></a>

## 12. Quy trình giao task cho AI Agent

Mỗi task giao cho AI Agent nên đi theo 5 bước, đúng tinh thần Dual Context (Technical Scaffolding + Cognitive Depth):

1. **Định nghĩa Contract IPC trước** — "Định nghĩa Request/Response type cho `feature:action-name` trong `0_contracts/ipc-payloads.ts`, nhớ field `traceId` bắt buộc."
2. **Viết Sub-module & Core Logic** — "Tạo Sub-module thuần TS trong `3_modules/sub-modules/`, kèm Unit Test Vitest."
3. **Xử lý Platform Adapter** — "Tạo Adapter trong `2_platform_adapters/storage/` để thao tác `chrome.storage.local`."
4. **Kết nối Engine Background** — "Đăng ký handler nhận message trong `1_engine/background/listeners/message-listener.ts`, route qua IPC Router tới Composite Module."
5. **UI/Inject nếu cần** — "Viết Mount Point Shadow DOM để inject UI vào trang đích."

**Câu hỏi bắt buộc AI trả lời trước khi code (bạn duyệt câu trả lời trước khi cho code chạy):**

> "Đoạn code này chạy trong context nào? Nó cần `chrome.*` API gì? Nếu Service Worker bị kill giữa lúc xử lý, hệ quả là gì và có mất dữ liệu không?"

Nếu AI không trả lời rõ ràng — tín hiệu code sẽ sai layer, dừng lại yêu cầu làm rõ trước khi tiếp tục.

---

_Tài liệu này nên được cập nhật mỗi khi có ADR mới phát sinh trong quá trình build, và nạp lại đầy đủ cho AI Agent ở đầu mỗi phiên làm việc mới._
