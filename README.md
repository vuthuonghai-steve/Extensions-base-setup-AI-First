# Chrome Extension MV3 Base — AI-First Starter Kit

> Template để khởi động **bất kỳ** Chrome Extension nào — tích hợp sẵn kiến trúc 5 layer, logging tập trung, CI gates, và đặc biệt: **một AI Agent Layer để AI code đúng chuẩn dự án ngay từ đầu, không cần bạn ngồi review từng dòng.**

|                     |                                                               |
| ------------------- | ------------------------------------------------------------- |
| **Nền tảng**        | Chrome Extension Manifest V3 (MV3)                            |
| **Framework**       | WXT + Vite + React 19                                         |
| **Ngôn ngữ**        | TypeScript strict mode                                        |
| **Quản lý package** | pnpm                                                          |
| **Kiến trúc**       | 5 layer phân lớp (`0_contracts` → `4_presentation`)           |
| **Testing**         | Vitest (unit/contract) + Playwright (E2E trên extension thật) |
| **CI**              | GitHub Actions — tự động hóa gates trước khi merge            |
| **AI-First**        | `.agent/` — hook scripts, rules, skills cho AI agent          |

---

## Tại sao lại cần repo này?

Hầu hết repo extension hiện nay đều dễ gặp 2 vấn đề quen thuộc:

1. **Thiếu guardrail kiến trúc** — AI (hoặc dev khi làm vội) dễ nhét business logic vào service worker, log rải rác tràn console, để lọt API key vào bundle hay import ngược giữa các layer... Những lỗi này thường lộ ra muộn dưới dạng bug "mất data âm thầm" rất khó trace.
2. **AI không nắm rule dự án** — hoặc rule nằm trong tài liệu mà AI không đọc, khiến bạn phải ngồi soi và review thủ công từng commit.

Repo này giải quyết bằng **AI Agent Layer**: toàn bộ quy chuẩn kiến trúc được tự động hóa thành **hook scripts chạy ngay khi AI ghi file**. AI vi phạm là bị block ngay tại chỗ — bạn không cần làm "cảnh sát code".

**So sánh nhanh:**

| Khía cạnh      | Repo extension thường               | Repo này                                                            |
| -------------- | ----------------------------------- | ------------------------------------------------------------------- |
| Kiến trúc      | Tùy dev, dễ vỡ cấu trúc             | 5 layer cứng, enforce bằng hook + dependency-cruiser                |
| Rule cho AI    | Viết lời nhắc trong README          | **Hook scripts block ngay lúc write file**                          |
| Log            | Console.log rải rác                 | Centralized logging, có `traceId`, Ring Buffer & Debug Console      |
| State          | Để ở SW memory → mất khi SW bị kill | Persist ra `chrome.storage`, test kỹ kịch bản SW restart            |
| Testing & CI   | "Chạy được là xong"                 | Pipeline gates: typecheck → lint → test → build → secret scan → E2E |
| AI dev feature | Code xong mới sửa, hên xui          | Quy trình 5 bước + tự verify bằng chứng trước khi hoàn tất          |

---

## Cấu trúc tổng thể (Layer 1 + Layer 2)

```
Extensions/
├── src/                    # ── LAYER 1: Core Extension Code ──
│   ├── 0_contracts/        #   Types & Schemas — Shared source of truth
│   ├── 1_engine/           #   WXT entrypoints (background SW, content scripts, UI pages)
│   ├── 2_platform_adapters/#   Wrapper bọc chrome.* APIs (storage, ipc, logging, config)
│   ├── 3_modules/          #   Business logic — 100% Pure TypeScript, dễ unit test
│   └── 4_presentation/     #   React UI (popup, sidepanel, debug console, shadow DOM)
│
├── tests/                  # Vitest (unit/contract) + Playwright E2E
├── scripts/                # validate-env (Zod validation lúc build)
├── .github/workflows/ci.yml# CI Pipeline
│
└── .agent/                 # ── LAYER 2: AI Agent Layer ──
    ├── hooks.json          #   Đăng ký hook scripts cho Claude Code / AI Agents
    ├── hooks/scripts/      #   ~15 gate scripts (block ngay khi ghi file sai rule)
    ├── rules/              #   11 rule architecture kèm theo mức độ enforce
    ├── skills/             #   Reusable workflow cho agent (git commit, logging...)
    └── Docs/               #   Tài liệu phân tích và thiết kế
```

---

## Layer 1 — Nền tảng Chrome Extension MV3

### Kiến trúc 5 tầng

```
┌───────────────────────────────────────────────────────────────┐
│ LAYER 4: PRESENTATION — React UI (popup/sidepanel/options/     │
│          debug-console, shadow-dom inject, design system)      │
├───────────────────────────────────────────────────────────────┤
│ LAYER 3: CORE MODULES — 100% Pure TypeScript, không chrome.*,  │
│          unit-test được (bookmark-manager, dom-parser, ...)    │
├───────────────────────────────────────────────────────────────┤
│ LAYER 2: PLATFORM ADAPTERS — bọc chrome.* 1-1 (storage, ipc,   │
│          telemetry, config)                                    │
├───────────────────────────────────────────────────────────────┤
│ LAYER 1: ENGINE — WXT entrypoints, chỉ Register & Listen       │
│          (background SW, content isolated/main, offscreen)     │
├───────────────────────────────────────────────────────────────┤
│ LAYER 0: CONTRACTS — Type/schema thuần, không phụ thuộc ai     │
│          (ipc-actions, ipc-payloads, storage-schema, ...)      │
└───────────────────────────────────────────────────────────────┘
```

**Quy tắc luồng phụ thuộc:** Phụ thuộc chỉ đi một chiều từ trên xuống — Layer 0 độc lập hoàn toàn, Layer 4 dùng được tất cả layer bên dưới. Đặc biệt, `3_modules/` **tuyệt đối không** import `chrome`/`document`/`window` (được kiểm soát tự động qua hook G1-06 và dependency-cruiser).

### Tech Stack

| Thành phần        | Công nghệ                          | Vai trò & Lý do                                                           |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Framework         | WXT 0.21 + Vite 8                  | Dev-server HMR mượt mà, build chuẩn MV3, quản lý entrypoint gọn           |
| UI Layer          | React 19 + `@wxt-dev/module-react` | Tái sử dụng component linh hoạt cho popup, sidepanel, options             |
| Language          | TypeScript 6 strict                | Ép type strict, yêu cầu `traceId` ngay ở **type level**                   |
| Validation        | Zod 4                              | Validate `.env` ngay khi build — báo lỗi ngay nếu thiếu biến môi trường   |
| Testing           | Vitest 4 + Playwright 1.62         | Vitest test unit/contract ở Layer 2–4; Playwright test E2E & SW lifecycle |
| Code Architecture | dependency-cruiser                 | Chống import ngược chiều giữa các layer                                   |

### Các quyết định thiết kế quan trọng

- **Không lưu state ở memory của Service Worker** — SW sẽ bị Chrome dừng (kill) sau khoảng 30s idle. Mọi state bắt buộc persist ra `chrome.storage` (dùng `session-cache.ts` để buffer & sync). Việc SW restart được verify bằng Playwright `context.serviceWorkers()`.
- **Centralized Logging (ADR-003)** — log ở mọi context được gom qua `logger.ts` → IPC `LOG_SINK` → Ring Buffer (`chrome.storage.session`) → broadcast Port → **Debug Console Page** (xem realtime, filter traceId/level, export JSON). Không dùng bare `console.log` ngoài `logger.ts`.
- **`traceId` bắt buộc cho IPC message** — định danh ở type level + check tự động bằng hook G1-07, giúp trace log xuyên qua nhiều process thành chuỗi sự kiện hoàn chỉnh.
- **Popup chỉ đóng vai trò View (ADR-007)** — không giữ business state trong React component state, mỗi lần mở sẽ fetch dữ liệu mới từ storage.
- **Giao tiếp Isolated ↔ Main World qua Bridge (ADR-001)** — đi qua `main-world-bridge.ts`, không bắn message rải rác giữa 2 world.
- **Không chứa Secret trong bundle** — extension client bundle là public. API key bên thứ 3 phải đi qua Backend Proxy (ADR-004), có hook G1-08 scan secret trong `dist/` khi build và ở CI.

---

## Layer 2 — AI Agent Layer (`.agent/`)

Điểm khác biệt của repo nằm ở đây: toàn bộ quy chuẩn kiến trúc được mã hóa thành các **hook scripts giúp AI tự tuân thủ**, thay vì phụ thuộc vào việc nhắc nhở thủ công.

### Cơ chế: Hook gates — Block vi phạm ngay khi ghi file

Mỗi rule trong dự án có trạng thái enforce rõ ràng (✅ Tự động kiểm tra / ⚠️ Rule mềm / ℹ️ Tài liệu tham khảo). Các rule ✅ được thực thi qua **~15 hook scripts** khai báo trong `.agent/hooks.json`:

| Event                                 | Gate script                        | Chức năng kiểm tra                                                                                      |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **PreToolUse** (trước khi write file) | `gate_contract_lock` (G0-03)       | Yêu cầu xác nhận khi sửa file trong `0_contracts/`                                                      |
|                                       | `gate_viability` (G0-04)           | Chặn viết code khi chưa có thiết kế/spec                                                                |
|                                       | `gate_arch_boundary` (G1-06)       | Chặn import ngược layer, dùng `chrome.*` trong `3_modules/`, bare console log, gửi message ngoài bridge |
|                                       | `gate_test_in_src` (G1-09)         | Chặn đặt file test inside `src/`                                                                        |
|                                       | `gate_test_bypass` (G0-05)         | Chặn dùng `--no-verify` hay skip test để bypass gate                                                    |
|                                       | G0-01 (chống hardcode)             | Chặn hardcode giá trị tạm thay cho biến môi trường                                                      |
| **PostToolUse** (sau khi write file)  | `gate_traceid` (G1-07)             | Bắt buộc `traceId` trong hợp đồng IPC                                                                   |
|                                       | `gate_secret_scan` (G1-08)         | Quét API key/secret lọt vào thư mục `dist/`                                                             |
| **Stop** (kết thúc phiên)             | G0-02 (scan repo)                  | Kiểm tra toàn bộ repo không còn code tạm/hardcode                                                       |
|                                       | `gate_stop_verify` (G0-06)         | Chặn kết thúc phiên khi code mới chưa qua test/verify                                                   |
|                                       | `gate_doc_structure` (G1-01/G1-03) | Kiểm tra cấu trúc tài liệu thiết kế                                                                     |
|                                       | `gate_evidence` (G2-03)            | Yêu cầu bằng chứng test/log khi báo hoàn thành                                                          |
| **PreInvocation**                     | `remind_domain_anchor` (G1-05)     | Nhắc nhở AI xác định đúng context trước khi thực thi                                                    |

> 🔥 **Lợi ích:** Các hooks này kích hoạt tự động khi AI (Claude Code) thao tác file — nếu vi phạm sẽ **bị chặn hoặc yêu cầu xác nhận ngay lập tức**, giúp code luôn chuẩn mà không tốn công theo dõi.

### 11 Rule kiến trúc — mỗi rule kèm mức enforce

`.agent/rules/` — nguồn sự thật cho agent, mỗi file ghi rõ mục nào đã thành hook, mục nào là quy ước:

| Rule                                | Nội dung chính                                                          |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `architecture-and-flow.md`          | Kiến trúc 5 tầng, ma trận execution context, luồng IPC                  |
| `wxt-extension-architecture.md`     | Engine chỉ Register & Listen, Content Worlds, IPC pattern               |
| `tech-stack-and-conventions.md`     | Stack, path aliases `@contracts/@engine/...`, naming, coding practices  |
| `code-quality-and-gates.md`         | Bảng Binary Gates chính thức (OBS/CFG/TST/ARC...) và trạng thái enforce |
| `config-and-environment.md`         | Bảng 4 loại config, nơi lưu đúng, cấm secret trong bundle               |
| `database-and-indexeddb-storage.md` | 3 storage drivers, session-cache, ring buffer, quota/evict              |
| `logging-and-observability.md`      | LogEntry 7 trường, Log Sink pipeline, self-debugging                    |
| `testing-and-verification.md`       | Testing Pyramid, Playwright MV3 kỹ thuật, thứ tự gate                   |
| `ui-architecture-conventions.md`    | Shadow DOM, ADR-001/007, tổ chức feature                                |
| `context-routing-and-modularity.md` | Load tài liệu khi cần, chống tràn context                               |
| `llm-core-principles.md`            | 5 nguyên lý tư duy, negative space, reverse probing, quy trình 5 bước   |

### Skills cho agent

`.agent/skills/` — tái sử dụng quy trình lặp lại: `git-commit-helper` (commit chuẩn conventional), `logging-best-practices`, `mermaid-diagrams`, `context-before-fix` (phân tích scope trước khi sửa).

---

## Bắt đầu nhanh

**Yêu cầu:** Node ≥ 22, pnpm ≥ 10.

```bash
pnpm install          # cài dependencies
cp .env.development .env.local  # nếu cần override cho máy local

pnpm dev              # dev-server WXT + HMR (thêm extension từ .output/chrome-mv3)
pnpm build            # build production → .output/chrome-mv3
pnpm test             # Vitest unit + contract
pnpm test -- --coverage  # kèm coverage (ngưỡng 90% lines trên 3_modules/)
pnpm e2e              # Playwright — load extension thật (chạy pnpm build trước)
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint
pnpm arc1             # dependency-cruiser — kiểm tra ranh giới tầng
pnpm zip              # đóng gói .zip cho Chrome Web Store
```

**Cài đặt thủ công:** `chrome://extensions` → Developer mode → Load unpacked → chọn `.output/chrome-mv3`.

### Nạp extension lên Chrome

```
pnpm dev  # hoặc pnpm build
```

Xem hướng dẫn từng bước tại [WXT — Getting Started](https://wxt.dev/guide/essentials/installation).

---

## Luồng CI Check trước khi Merge

Mọi Pull Request đều phải vượt qua pipeline kiểm tra tự động trên GitHub Actions (`ci.yml`):

```
typecheck (BASE-0) → lint (OBS-1, TYP-1) → format check
→ vitest + coverage (TST-1) → build (check biến env - CFG-2)
→ dependency-cruiser (ARC-1) → secret scan dist/ (CFG-1)
→ Playwright E2E (TST-2, OBS-3) trên build extension thật
```

Chỉ cần 1 bước fail, PR sẽ bị block merge.

---

## Cấu trúc thư mục chi tiết

```text
src/
├── 0_contracts/          # ipc-actions.ts, ipc-payloads.ts, storage-schema.ts,
│                         # log-schema.ts, config-schema.ts, domain-entities.ts
├── 1_engine/             # background/ (index, lifecycle, listeners, state)
│                         # content/isolated-world/ (dom-bridge, main-world-bridge)
│                         # content/main-world/ (page-context-hook)
│                         # offscreen/, popup/, sidepanel/, options/, debug-console/
├── 2_platform_adapters/  # storage/ (local, sync, session), ipc/ (router, sender,
│                         #   port-channel), telemetry/ (logger, log-sink,
│                         #   log-ring-buffer, log-broadcaster, trace-id),
│                         # config/ (build-config, runtime-config-adapter)
├── 3_modules/            # sub-modules/ (time-formatter, dom-parser, ai-stream-decoder)
│                         # composite-modules/bookmark-manager/ (use-cases/)
└── 4_presentation/       # extension-views/ (popup-app, sidepanel-app,
                          #   options-app, debug-console-app),
                          # shadow-dom/, main-world-ui/, shared-design-system/

tests/
├── unit/                 # Vitest theo tầng: 1_engine, 2_platform_adapters, 3_modules, 4_presentation
├── contract/             # ipc-payload-shape.spec.ts — khóa shape IPC payload
└── e2e/                  # fixtures/extension.fixture.ts (launchPersistentContext +
                          #   serviceWorkers()) + flows/ (smoke, log-sink, ipc-settings,
                          #   sw-restart, debug-console)
```

---

## Lưu ý quan trọng (Notes)

- **Prefix số ở tên thư mục (`0_`…`4_`)** — thể hiện **hướng phụ thuộc của kiến trúc** (layer số nhỏ hơn là hạ tầng, layer số lớn hơn không được import ngược lại), không phải thứ tự chạy.
- **`traceId` bắt buộc** — mọi message IPC đều phải kèm `traceId` (UUIDv4) để hỗ trợ truy vết log xuyên suốt các process.
- **Quản lý Config** — chỉ đặt ở 3 nơi: `config-schema.ts` (schema), `build-config.ts` (biến tĩnh build-time) và `runtime-config-adapter.ts` (biến động lưu ở `chrome.storage`).
- **Bảo mật Secret** — không đưa secret/key vào repo client. `.env.*` chỉ chứa config public; API key phía bên thứ 3 phải qua Backend Proxy.
- **Tuyệt đối không hardcode** — không dùng giá trị tạm thay cho biến môi trường; hook scripts sẽ chặn ngay khi ghi file.
- **Môi trường chạy:** CI và scripts hỗ trợ tốt trên Linux/macOS. Nếu dùng Windows nên chạy qua WSL hoặc Git Bash (do script dùng `python3`).
- **Node version:** Khuyến nghị Node 22 (chạy `nvm use` trước khi `pnpm install`).

---

## Tài liệu tham khảo

- Kiến trúc chi tiết: `Docs/Setups/Architect-workspace/Architect-workspace.md` (§1–§12: 5 tầng, ma trận context, ADR, Binary Gates)
- Quyết định thiết kế: `docs/decisions/`, `Docs/Trade-offs/AGENTS.md`
- Negative space (điều KHÔNG được làm): `docs/negative-space.md`
- Bản đồ gate → hook: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`
