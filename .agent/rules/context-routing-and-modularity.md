---
trigger: model_decision
description: 'Chiến lược quản lý context window, nén ngữ cảnh và điều phối load tài liệu theo yêu cầu (On-Demand Context Ingestion) cho Chrome Extension MV3 (WXT)'
---

# 📦 Rule: Context Modularity & Dynamic Routing Strategy (MV3)

Rule này định hướng cách Agent nạp và quản lý thông tin context tại dự án Chrome Extension MV3 (WXT) để tối ưu hóa context window và giữ độ chính xác trong suy luận.

## 1. Nguyên lý "Load Khi Cần" (On-Demand Context Ingestion)

- **Không nạp rác:** Agent tuyệt đối KHÔNG đọc toàn bộ tài liệu hay codebase nếu tác vụ chỉ liên quan đến một module cụ thể.
- **Truy xuất theo bản đồ:** Trước khi thực hiện công việc, Agent tra cứu bản đồ điều phối tại [`Docs/Trade-offs/AGENTS.md`](../../Docs/Trade-offs/AGENTS.md) — nguồn sự thật về 5 Core Cognitive Principles (§1) và 8-Stage Pipeline (§2) — để nạp đúng tài liệu/rule tối thiểu cần thiết.
- **Tập trung ngữ cảnh:** Chỉ nạp thêm thông tin chi tiết khi cần làm việc với các hệ thống phức tạp:
  - Đặc tả kiến trúc tổng thể: [`Docs/Setups/Architect-workspace/Architect-workspace.md`](../../Docs/Setups/Architect-workspace/Architect-workspace.md) — Domain Anchoring & Reverse Probing (§1), Ma trận Execution Context (§2), kiến trúc phân tầng + cây thư mục (§3-§5), Telemetry/Config (§6), chiến lược test (§7), Binary Gates (§11), quy trình giao task (§12).
  - Đặc tả logging/testing chi tiết: `Architect-workspace.md §6-§7`.
- Các rule chuyên domain (storage, config, logging, testing...) chỉ được nạp khi task chạm đúng domain đó.

## 2. Tránh Phân mảnh Quá Mức (Anti-Over-Fragmentation)

- Gom nhóm rule theo **Domain chức năng hiện tại** (11 file): `architecture`, `wxt`, `quality-gates`, `config`, `storage`, `logging`, `testing`, `tech-stack`, `ui`, `llm-principles`, `context-routing`.
- Đảm bảo mỗi file rule trong `.agent/rules/` có mục đích rõ ràng, ngắn gọn và nằm trong giới hạn cho phép (< 12,000 ký tự/file).
- Không tạo file rule mới trùng phạm vi file đã có — bổ sung nội dung vào file đúng domain thay vì sinh file mới làm loãng bản đồ.

## 3. Nạp lại kiến trúc đầu mỗi phiên

- **Nạp lại `Docs/Setups/Architect-workspace/Architect-workspace.md` đầy đủ ở đầu mỗi phiên làm việc mới** (theo chỉ dẫn của chính tài liệu) — chống trôi ngữ nghĩa (Semantic Drift) mỗi khi có ADR mới.
- Đồng thời re-feed `Docs/Trade-offs/AGENTS.md` §1 để neo lại 5 nguyên lý tư duy cốt lõi trước khi thực thi bất kỳ nhiệm vụ nào.

## 4. Cập nhật & Đồng bộ Rule (Rule Synchronization)

- Khi tái cấu trúc hệ thống, thêm alias mới hoặc bổ sung module:
  - Agent có trách nhiệm cập nhật các file rule tương ứng trong `.agent/rules/`.
  - Đồng bộ lại chỉ mục tham chiếu tại [`Docs/Trade-offs/AGENTS.md`](../../Docs/Trade-offs/AGENTS.md) để tránh lệch context ở các phiên làm việc sau.
  - Cập nhật `Architect-workspace.md` mỗi khi phát sinh ADR mới trong quá trình build.
