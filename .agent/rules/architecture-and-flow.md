---
trigger: model_decision
description: "Kích hoạt khi cần phân tích kiến trúc 5 tầng, ma trận Execution Context, luồng IPC, hoặc refactor module lớn trong Chrome Extension MV3 (WXT)"
---

# 🏗️ Rule: Kiến trúc & Luồng Dữ Liệu — Chrome Extension MV3 (WXT)

Rule này áp dụng khi thiết kế tính năng mới, tái cấu trúc hệ thống hoặc làm việc với giao tiếp giữa các tầng trong Chrome Extension MV3 (WXT).

> ✅ **Trạng thái enforce:** các rule ranh giới phụ thuộc (§3) và `traceId` (§4) đã được cơ học hóa thành hooks gate (`G1-06`, `G1-07`, `G0-03`) — chặn ngay lúc ghi file, không còn là rule "tự khai báo, tự kiểm". Phần còn lại đánh dấu ⚠️ vẫn là rule mềm. Chi tiết: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.

## Mục lục

1. [Kiến trúc 5 tầng](#1)
2. [Ma trận Execution Context](#2)
3. [Quy tắc ranh giới phụ thuộc](#3)
4. [Luồng runtime IPC](#4)
5. [Quy trình giao task](#5)

<a name="1"></a>
## 1. Kiến trúc 5 tầng

```txt
┌────────────────────────────────────────────────────────────────┐
│ LAYER 4: PRESENTATION / UI SYSTEM                               │
│ Extension Pages (Popup, SidePanel, Options, Debug Console)      │
│ + UI inject vào trang web (Shadow DOM)                          │
└───────────────┬────────────────────────────────────────────────┘
                │ Component Props & Events
┌───────────────▼────────────────────────────────────────────────┐
│ LAYER 3: CORE BUSINESS MODULES (Pure TypeScript)                │
│ sub-modules | composite-modules | use-cases                     │
│ KHÔNG gọi chrome.* — 100% test được bằng Vitest                 │
└───────────────┬────────────────────────────────────────────────┘
                │ Invokes qua interface
┌───────────────▼────────────────────────────────────────────────┐
│ LAYER 2: PLATFORM ADAPTERS & IPC ROUTER (bọc chrome.* 1-1)      │
│ ipc | storage | tabs | scripting | declarative-net              │
│ telemetry/ + config/ (cross-cutting, nằm vật lý tại đây)        │
└───────────────┬────────────────────────────────────────────────┘
                │ Direct Binding
┌───────────────▼────────────────────────────────────────────────┐
│ LAYER 1: MANIFEST V3 ENGINE ENTRYPOINTS (WXT)                   │
│ background (SW) | content (isolated/main) | offscreen           │
│ ui-pages (chỉ index.html) — chỉ Register & Listen               │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│ LAYER 0: CONTRACTS (Type/Schema — nguồn sự thật duy nhất)       │
│ ipc-actions | ipc-payloads | storage-schema | domain-entities   │
└────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc dòng chảy phụ thuộc**: mũi tên chỉ hướng "ai được import ai" — Layer 0 không phụ thuộc gì, Layer 4 phụ thuộc mọi thứ bên dưới. **Không bao giờ đi ngược.**

<a name="2"></a>
## 2. Ma trận Execution Context

Đây là "luật vật lý" của nền tảng — mọi quyết định kiến trúc phía sau đều là hệ quả trực tiếp của bảng này.

| Context | DOM | `chrome.*` API | Network (CORS) | Vòng đời |
|---|---|---|---|---|
| **Background Service Worker** | ❌ không có DOM | ✅ đầy đủ nhất | ✅ bypass CORS | Event-driven, Chrome tự kill sau **~30s idle**, tối đa ~5 phút dù active; state qua `chrome.storage` |
| **Content — Isolated World** | ✅ đọc/ghi DOM, **không thấy** biến JS trang | ⚠️ hạn chế (`runtime`, `storage`, `i18n`) | ❌ bị CORS/CSP trang chặn | Theo vòng đời tab/frame |
| **Content — Main World** | ✅ DOM + biến JS global của trang | ❌ không có `chrome.*` — phải `postMessage` ngược ra Isolated World | ❌ | Theo tab |
| **Popup / SidePanel / Options** | ✅ DOM riêng, không đụng trang web | ✅ đầy đủ | ✅ bypass CORS | Popup **chết ngay khi mất focus** → không giữ business state |
| **Offscreen Document** | ✅ DOM đầy đủ (ẩn) | ✅ đầy đủ | ✅ bypass CORS | Ẩn, SW mượn khi cần DOM/Audio/Clipboard; quản lý qua `chrome.offscreen` |

Hệ quả kiến trúc trực tiếp:

- SW không đáng tin về state → state phải externalize ra `chrome.storage`.
- 2 "world" khác nhau trong Content Script → cây thư mục **tách vật lý** `isolated-world/` và `main-world/`.
- Popup chết bất cứ lúc nào → chỉ là view, state thật nằm ở storage.
- Bundle luôn public → **không có secret** trong extension.

<a name="3"></a>
## 3. Quy tắc Ranh giới Phụ thuộc

```
0_contracts/        ◄── không phụ thuộc ai
     ▲
2_platform_adapters/◄── chỉ phụ thuộc 0_contracts (gồm telemetry/, config/)
     ▲
3_modules/          ◄── phụ thuộc 0_contracts + gọi Layer 2 qua interface
     ▲
1_engine/ & 4_presentation/  ◄── lắp ráp mọi thứ lại
```

Quy tắc cứng (enforce bằng lint/CI, không phải tự giác):

| Rule | Cơ chế enforce | Trạng thái |
|---|---|---|
| `1_engine/` chỉ import `2_platform_adapters/` + `0_contracts/` — không import thẳng logic `3_modules/` không qua router | 🔥 Hook **G1-06** `gate_arch_boundary.py` (forbidden_imports) + dependency-cruiser ARC-1 | ✅ Cơ học hóa |
| `3_modules/` cấm import `1_engine/`/`2_platform_adapters/` — 100% Pure TS, không `chrome`, không `document`/`window` | 🔥 Hook **G1-06** (forbidden_imports + chrome/dom regex, chỉ áp dụng khi TargetFile chứa `3_modules/`) + ARC-2 | ✅ Cơ học hóa |
| `2_platform_adapters/` chỉ phụ thuộc `0_contracts/` | dependency-cruiser ARC-1 (chưa có hook riêng) | ⚠️ Còn soft |
| Giao tiếp Isolated ↔ Main World **chỉ qua `main-world-bridge.ts`**, không `postMessage` trần | 🔥 Hook **G1-06** (post_message_regex, ngoại trừ bridge_file) | ✅ Cơ học hóa |
| Cấm `console.log` trần trong `src/` (trừ `telemetry/logger.ts`) | 🔥 Hook **G1-06** (console_log_regex + logger_file) + ESLint OBS-1 | ✅ Cơ học hóa |
| `telemetry/` + `config/` là cross-cutting, nằm vật lý tại Layer 2 | Kiến thức kiến trúc — không enforce được | ℹ️ Giữ nguyên |

> 📌 Regex/đường dẫn chính xác nằm ở `.agent/hooks/scripts/config/rules.yaml` (section `arch_boundary`); danh sách gate đầy đủ tại `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md` (§2 — G1-06, G0-03).

<a name="4"></a>
## 4. Luồng Runtime IPC

```txt
UI (4_presentation)
    │  Message (Discriminated Union, kèm traceId BẮT BUỘC)
    ▼
2_platform_adapters/ipc/sender.ts          (timeout + retry)
    ▼
1_engine/background/listeners/message-listener.ts   (CHỈ route)
    ▼
2_platform_adapters/ipc/router.ts          (dispatch tới handler)
    ▼
3_modules/composite-modules                (use-case)
    │  gọi adapter qua interface
    ▼
2_platform_adapters/... (storage | tabs | ...)
    │
    ▼
MessageResponse { ok: true, data } | { ok: false, error }
```

- Mọi message **bắt buộc mang `traceId`** — enforce ở type level (field bắt buộc, không optional) trong `0_contracts/ipc-payloads.ts`, build fail nếu thiếu + 🔥 Hook **G1-07** `gate_traceid.py` (PostToolUse backstop) + **G0-03** `gate_contract_lock.py` (force_ask khi sửa `0_contracts/`).
- `sender.ts` bắt buộc **timeout + retry** — SW có thể "ngủ", message đầu dễ bị mất, không được fail âm thầm. ⚠️ Chưa có hook — còn soft.
- SW bị kill → state qua `chrome.storage`, không giữ biến global trong memory. ⚠️ Chưa có hook — còn soft.
- Streaming (log real-time...) dùng `port-channel.ts` (long-lived connection). ⚠️ Chưa có hook — còn soft.

<a name="5"></a>
## 5. Quy trình 

1. **Định nghĩa Contract IPC trước** — Request/Response type trong `0_contracts/ipc-payloads.ts`, nhớ field `traceId` bắt buộc.
2. **Viết Sub-module & Core Logic** — thuần TS trong `3_modules/sub-modules/`, kèm Unit Test Vitest.
3. **Xử lý Platform Adapter** — trong `2_platform_adapters/storage/` (thao tác `chrome.storage`).
4. **Kết nối Engine Background** — đăng ký handler trong `1_engine/background/listeners/message-listener.ts`, route qua IPC Router tới Composite Module.
5. **UI/Inject nếu cần** — Mount Point Shadow DOM trong `4_presentation/`.


> "Đoạn code này chạy trong context nào? Nó cần `chrome.*` API gì? Nếu Service Worker bị kill giữa lúc xử lý, hệ quả là gì và có mất dữ liệu không?"