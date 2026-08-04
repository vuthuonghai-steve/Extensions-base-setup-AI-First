# Kiến Trúc Hooks (Hooks Architecture Documentation)

Thư mục này chứa tài liệu kiến trúc thực tế chuẩn hóa cho hệ thống **Antigravity IDE Hooks** trong dự án Chrome Extension MV3 (WXT).

## 📄 Các Tài Liệu Chính

- 📐 **[architecture.md](file:///home/stveve/Documents/workspace/Steve/Setup-project/Extensions/.agent/Docs/architects/hooks/architecture.md)** — **Tài Liệu Kiến Trúc Thực Tế Tối Cao (Actual Architecture Specification)**. Phân tích 4 tầng mô-đun, ma trận 16 Gate Handlers (G0-01 đến G2-04), cơ chế Wide-Event Logging (JSONL), sơ đồ Mermaid và bộ 109 unit tests.

## 🔗 Tài Liệu Tham Cho Phân Tích & Lịch Sử

- 💡 `Docs/analys/hooks/architecture-redesign-proposal.md`: Đề xuất tái thiết kế kiến trúc mô-đun ban đầu.
- 📋 `Docs/analys/hooks/rules-to-hooks-gate-list.md`: Danh sách ánh xạ từ Rule mềm sang Hook Gate Python.
- ⚡ `Docs/analys/hooks/hooks-enforce-soft-rules.md`: Phân tích chuyển đổi Rule mềm thành Rule cứng.
- ⚙️ `.agent/hooks.json`: File cấu hình đăng ký hook events với Antigravity IDE Engine.
