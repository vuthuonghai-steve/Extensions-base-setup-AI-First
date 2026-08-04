---
trigger: glob
description: 'Quy chuẩn công nghệ, cấu trúc thư mục src/ 5 tầng và chuẩn mực lập trình TypeScript / React / WXT cho Chrome Extension MV3'
globs: ['*.ts', '*.tsx', 'wxt.config.ts', 'package.json']
---

# 💻 Rule: Tech Stack & Coding Conventions

Rule này áp dụng tự động cho các file nguồn mã lệnh (`.ts`, `.tsx`, file cấu hình WXT/NPM). Nguồn sự thật duy nhất: `Docs/Setups/Architect-workspace/Architect-workspace.md` (§3–§5, §8–§11).

> ✅ **Trạng thái enforce:** cấm `console.log` trần, cấm `as any`/`@ts-ignore`, import ngược tầng (prefix `0_`…`4_`) và `traceId` bắt buộc đã được cơ học hóa thành hooks gate — **G1-06** `gate_arch_boundary.py` (console_log_regex, ts_ignore, forbidden_imports, chrome/dom/post_message regex — deny lúc ghi file) + **G1-07** `gate_traceid.py` (PostToolUse backstop). Các quy ước còn lại đánh dấu ⚠️ là rule mềm / ℹ️ kiến thức, lớp chặn là CI/ESLint. Config: `.agent/hooks/scripts/config/rules.yaml` (sections `arch_boundary`, `traceid`); danh sách gate đầy đủ: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md` (§2).

## 1. Stack & Tooling Chuẩn

- **Framework:** WXT (Web Extension Tools) + Vite, Manifest V3.
- **UI Framework:** React + React DOM (qua `@wxt-dev/module-react`).
- **Language:** TypeScript chế độ **strict mode**.
- **Testing:** Vitest (unit / component / contract — phủ Layer 2–4 component) + Playwright (E2E chạy trên extension thật qua `--load-extension`, phủ Layer 1 + IPC end-to-end — ADR-005).
- **Validation:** Zod — `0_contracts/config-schema.ts` validate `.env` build-time; build **fail cứng** nếu thiếu biến bắt buộc (CFG-2 — ⚠️ Còn soft, lớp chặn là CI).

> ⚠️ Ghi chú: version cụ thể của từng dependency cần **verify theo `package.json` khi triển khai** — không hardcode version tại đây.

## 2. Cây thư mục `src/` — 5 tầng (tóm tắt §4)

```text
src/
├── 0_contracts/                    # LAYER 0 — nguồn sự thật, không phụ thuộc ai
│   ├── ipc-actions.ts              # Enum tên toàn bộ message action
│   ├── ipc-payloads.ts             # Type Request/Response, traceId BẮT BUỘC ✅ G1-07 (backstop) + type-level
│   ├── storage-schema.ts           # Type cho từng key trong chrome.storage
│   ├── domain-entities.ts          # Type nghiệp vụ thuần (Bookmark, User...)
│   ├── log-schema.ts               # Type LogEntry
│   └── config-schema.ts            # Zod schema validate .env lúc build
│
├── 1_engine/                       # LAYER 1 — chỉ Register & Listen
│   ├── background/
│   │   ├── index.ts                # Bootstrap (defineBackground)
│   │   ├── lifecycle/              # on-installed.ts, on-startup.ts, keep-alive.ts
│   │   ├── listeners/              # message-, tabs-, alarms-, context-menu-listener.ts
│   │   └── state/session-cache.ts  # chrome.storage.session
│   ├── content/
│   │   ├── isolated-world/         # có chrome.* (index.ts, dom-bridge.ts, main-world-bridge.ts)
│   │   └── main-world/             # thấy JS trang, KHÔNG có chrome.* (page-context-hook.ts)
│   ├── offscreen/                  # index.ts + handlers/ (dom-parse-handler.ts)
│   └── ui-pages/                   # popup/, sidepanel/, options/, debug-console/ (index.html)
│
├── 2_platform_adapters/            # LAYER 2 — bọc chrome.* 1-1
│   ├── ipc/                        # router.ts, sender.ts (timeout + retry), port-channel.ts
│   ├── storage/                    # local-driver.ts, sync-driver.ts, session-driver.ts
│   ├── tabs/tabs-adapter.ts
│   ├── scripting/                  # inject-isolated.ts, inject-main.ts
│   ├── declarative-net/rules-adapter.ts
│   ├── permissions/optional-permissions-adapter.ts
│   ├── telemetry/                  # logger.ts, log-sink.ts, log-ring-buffer.ts, trace-id.ts, log-broadcaster.ts
│   └── config/                     # build-config.ts, runtime-config-adapter.ts
│
├── 3_modules/                      # LAYER 3 — 100% Pure TypeScript
│   ├── sub-modules/                # hàm đơn nhiệm (time-formatter/, dom-parser/, ai-stream-decoder/)
│   └── composite-modules/          # {feature}/index.ts + use-cases/*.ts + {feature}.test.ts
│
└── 4_presentation/                 # LAYER 4 — xem ui-architecture-conventions.md
    ├── main-world-ui/
    ├── shadow-dom/                 # mount-point.ts, InjectedButton.tsx
    ├── extension-views/            # popup-app/, sidepanel-app/, debug-console-app/
    └── shared-design-system/

tests/
├── unit/                           # Vitest — mock chrome qua fake-browser
├── e2e/                            # Playwright — fixtures/extension.fixture.ts, flows/
└── contract/                       # ipc-payload-shape.spec.ts
```

## 3. Path Aliases (`wxt.config.ts`)

Tất cả import trong project bắt buộc dùng path aliases chuẩn — **thay thế hoàn toàn 6 alias cũ** (`@domain`, `@app`, `@infra`, `@shared`, `@features`, `@composition` đã bị xóa) — ⚠️ Còn soft, chưa có hook riêng cho alias:

- `@contracts` → `src/0_contracts`
- `@engine` → `src/1_engine`
- `@platform` → `src/2_platform_adapters`
- `@modules` → `src/3_modules`
- `@presentation` → `src/4_presentation`

> Lưu ý: `telemetry/` và `config/` là **cross-cutting concern** nằm vật lý trong Layer 2 — import qua `@platform/telemetry` và `@platform/config`, **không có alias riêng**.

## 4. Naming & Folder Conventions

- **Đặt tên file:** kebab-case (`ipc-actions.ts`, `mount-point.ts`, `keep-alive.ts`, `log-ring-buffer.ts`).
- **Đặt tên Type/Interface/Component:** PascalCase (`InjectedButton`, `LogViewer`, `StorageInspector`, `Bookmark`).
- **Đặt tên hàm/biến:** camelCase (`sendMessage`, `saveBookmark`).
- **Prefix số `0_`…`4_`** trên thư mục enforce dependency direction — Layer thấp không được import Layer cao (ARC-1). ✅ Cơ học hóa — Hook **G1-06** `gate_arch_boundary.py` (forbidden_imports) + dependency-cruiser (CI).

## 5. Standard Coding Practices

- Khai báo rõ ràng kiểu dữ liệu trả về cho mọi hàm public utility hoặc domain logic. ⚠️ Còn soft — quy ước, chưa có hook.
- Ưu tiên `const`, **cấm dùng `var`**. ⚠️ Còn soft — ESLint, chưa có hook.
- Dùng `type` hoặc `interface` tường minh, tránh ép kiểu `any`. ⚠️ Còn soft — riêng `as any` cụ thể thuộc **G1-06** (ts_ignore).
- Xử lý bất đồng bộ bằng `async/await` và trả về `Result<T, E>`. ⚠️ Còn soft — quy ước, không phải gate (xem `code-quality-and-gates.md` §3).
- **Cấm `console.log` trần** ngoài `2_platform_adapters/telemetry/logger.ts` (OBS-1). 🔥 Hook **G1-06** `gate_arch_boundary.py` (console_log_regex, ngoại trừ `telemetry/logger.ts`) + ESLint — ✅ Cơ học hóa.
- **Cấm `as any` / `@ts-ignore`** (TYP-1) — nếu cần ép kiểu, khai báo type/interface tường minh. 🔥 Hook **G1-06** `gate_arch_boundary.py` (ts_ignore patterns) + ESLint — ✅ Cơ học hóa.
