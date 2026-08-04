---
trigger: glob
description: 'Quy chuẩn kiến trúc Layer 4 Presentation cho Chrome Extension MV3 — hai thế giới UI, Shadow DOM, ADR-001/ADR-007, tổ chức feature thay thế src/features'
globs: ['src/4_presentation/**', 'src/3_modules/composite-modules/**']
---

# 🎨 Quy chuẩn Kiến trúc Giao diện (UI Architecture Conventions)

Nguồn sự thật: `Docs/Setups/Architect-workspace/Architect-workspace.md` (§5 Layer 4, §8 Ma trận Quyền hạn, §10 ADR-001/ADR-007, §11 Gates, §12).

> ✅ **Trạng thái enforce:** quy tắc Main World ↔ Isolated World chỉ liên lạc qua `main-world-bridge.ts` (không `postMessage` rải rác, §4) đã được cơ học hóa thành hook **G1-06** `gate_arch_boundary.py` (post_message_regex + bridge_file) — deny ngay lúc ghi file. Các quy ước UI còn lại đánh dấu ⚠️ là rule mềm / ℹ️ kiến thức. Config: `.agent/hooks/scripts/config/rules.yaml` (section `arch_boundary`); danh sách gate đầy đủ: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md` (§2).

## 1. Hai thế giới UI (Layer 4 — Presentation)

| Thế giới UI                 | Vị trí                                                                          | Đặc điểm                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Extension Surfaces**      | `4_presentation/extension-views/` (popup-app, sidepanel-app, debug-console-app) | React SPA thông thường, DOM riêng, `chrome.*` đầy đủ, bypass CORS                                                                        |
| **UI inject vào trang web** | `4_presentation/shadow-dom/`, `main-world-ui/`                                  | **BẮT BUỘC qua Shadow DOM** để cô lập CSS — trang đích không phá giao diện extension và ngược lại ⚠️ Còn soft — quy ước UI, chưa có hook |

## 2. Cấu trúc `4_presentation/`

```text
4_presentation/
├── main-world-ui/          # UI trong Main World — HIẾM DÙNG, không có chrome.*,
│                           # giao tiếp qua postMessage bridge (ADR-001)
├── shadow-dom/             # Chuẩn inject: mount-point.ts (attachShadow) + InjectedButton.tsx
├── extension-views/
│   ├── popup-app/          # Popup — chỉ là view, KHÔNG giữ business state (ADR-007)
│   ├── sidepanel-app/      # SidePanel — menu tĩnh thuần presentation (menu.ts)
│   └── debug-console-app/  # Cockpit quan sát toàn hệ thống (OBS-3):
│                           # LogViewer.tsx, StorageInspector.tsx, export-logs.ts
└── shared-design-system/   # Primitives dùng chung: Button, Input, Badge, Modal
                            # (kế thừa tinh thần src/ui/components/primitives cũ)
```

## 3. ADR-007 — Popup chỉ là View

- Popup **KHÔNG giữ business state** trong React state — state thật nằm `chrome.storage`. ⚠️ Còn soft — review thủ công (xem Negative Space, `code-quality-and-gates.md` §4).
- Mỗi lần mở popup phải **fetch lại state** từ storage (chấp nhận độ trễ nhỏ, đổi lại không mất dữ liệu khi popup đóng đột ngột). ⚠️ Còn soft — chưa có hook.
- Áp dụng tinh thần tương tự cho SidePanel/Options. ℹ️ Kiến thức.

## 4. ADR-001 — Main World ↔ Isolated World

- Chỉ liên lạc qua `main-world-bridge.ts` (`1_engine/content/isolated-world/`) — **không `postMessage` rải rác** trong code. ✅ Cơ học hóa — Hook **G1-06** `gate_arch_boundary.py` (post_message_regex + bridge_file).
- Main World **không gọi `chrome.storage` trực tiếp** — mọi thao tác đi qua bridge → Isolated World xử lý. ⚠️ Còn soft — G1-06 chỉ chặn `postMessage` ngoài bridge, không check `chrome.*` ở main-world.

## 5. Tổ chức Feature (thay thế `src/features/`)

| Thành phần cũ (`src/features/`) | Vị trí mới                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Use-cases                       | `3_modules/composite-modules/{feature}/use-cases/` + `index.ts` + `.test.ts` |
| Logic đơn nhiệm                 | `3_modules/sub-modules/`                                                     |
| Types / contract                | `0_contracts/`                                                               |
| Bridges / services              | `2_platform_adapters/`                                                       |
| Screen / sub-components / hooks | `4_presentation/extension-views/{app}/` hoặc `shadow-dom/`                   |

## 6. Đã Bỏ Hoàn Toàn

- `registry.ts`, `MODULES`, `moduleMeta`, Component export contract
- `src/features/`, `src/ui/`, `HomeDashboard` / `ModuleCard` / `ModulePage`
- Đồng bộ cây kiến trúc qua `tree_work.md`
- Đường dẫn dự án cũ: `quick_zalo`, `Sales Workspace`, `entrypoints/`, `composition/`, `@features`

> Nếu cần menu điều hướng → khai báo **tĩnh thuần presentation** trong `4_presentation/extension-views/sidepanel-app/` (vd `menu.ts`), **không mang business meta**.

## 7. Quy tắc Đồng bộ

- Khi thêm module mới → cập nhật `Architect-workspace.md` (theo §12) thay vì `tree_work.md`. ℹ️ Kiến thức — quy trình tài liệu, không enforce.
