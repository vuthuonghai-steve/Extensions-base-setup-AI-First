---
trigger: glob
globs: ["src/0_contracts/config-schema.ts", "src/2_platform_adapters/config/**", "wxt.config.ts"]
description: "Quy chuẩn kiến trúc Cấu hình (Config) & Biến Môi trường trong Chrome Extension MV3 (WXT)"
---

# ⚙️ Rule: Configuration & Environment Management

Rule này quy định kiến trúc config, bảo mật secret và quản lý biến môi trường trong dự án Chrome Extension MV3 (WXT). Nguồn sự thật: `Architect-workspace.md` §6.3 (Kiến trúc Config), ADR-004 (Backend Proxy giữ key), §11 (Gates CFG-1/CFG-2), §5 (Layer 2).

> ✅ **Trạng thái enforce:** scan secret sau build và cấm placeholder trong config đã cơ học hóa thành hooks gate — **G1-08** `gate_secret_scan.py` (PostToolUse backstop sau lệnh build) + **CFG-1** CI scan, và **G0-01** `gate_placeholder_pre.py` + **G0-02** `gate_placeholder_stop.py` (chặn placeholder ngay lúc ghi file). Phần còn lại (kiến trúc config, CFG-2) đánh dấu ⚠️/ℹ️ vẫn là rule mềm. Chi tiết: `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.

---

## 1. BẢO MẬT SECRET — Ràng buộc tiên quyết

> Bundle extension luôn public, không có "server-side secret" — bất kỳ ai cũng unpack và đọc plaintext file `.js`. Đây là giới hạn vật lý, không phải best-practice tùy chọn.

- **CẤM tuyệt đối** đặt API key bên thứ 3 (bạn trả tiền) trong extension — nhét vào = phát key miễn phí cho mọi người dùng.
- Mọi key trả phí bắt buộc nằm ở **Backend Proxy** giữ key (ADR-004); extension chỉ gọi proxy, không bao giờ chứa key.
- Lưu ý tinh tế: "encrypt nếu cần" chỉ chống **casual inspection** (người mở file nhìn thoáng qua), **không chống unpack thật** — vì key giải mã cũng nằm trong bundle, không bao giờ được dùng encryption để biện minh cho việc giữ secret trong extension.

> 🔥 Phần trên là kiến thức thiết kế (ℹ️ — giữ nguyên); lớp chặn cơ học của rule "không secret trong bundle" là **G1-08** `gate_secret_scan.py` (quét `dist/` sau build) + **CFG-1** (CI scan).

---

## 2. Bảng 4 loại Config & nơi lưu đúng

| Loại config | Nơi lưu đúng | Lý do |
|---|---|---|
| Config public (feature flag, endpoint URL) | `.env` build-time qua `import.meta.env` | Không nhạy cảm |
| API key bên thứ 3 (bạn trả tiền) | ❌ Không bao giờ trong extension — bắt buộc Backend Proxy giữ key | Nhét vào = phát key miễn phí cho mọi người dùng |
| Token của chính người dùng (họ tự nhập) | `chrome.storage.local`, encrypt nếu cần | Runtime config, khác biến build-time |
| Config runtime người dùng chỉnh | `chrome.storage.sync`/`local` | Preference, không phải secret |

Phân loại bắt buộc trước khi viết bất kỳ config nào: biến thuộc nhóm nào trong bảng trên → mới quyết định nơi lưu. Không có nhóm thứ 5. ℹ️ Kiến thức — không có hook.

---

## 3. Vị trí file bắt buộc

| File | Vai trò | Ràng buộc |
|---|---|---|
| `src/0_contracts/config-schema.ts` | Zod schema validate `.env` lúc build; nguồn định nghĩa biến bắt buộc | Layer 0 — không phụ thuộc ai, **cấm import `chrome.*`** |
| `src/2_platform_adapters/config/build-config.ts` | Chỉ đọc `import.meta.env` build-time, config public | **Tĩnh** — giá trị khóa tại lúc build, không đổi lúc runtime |
| `src/2_platform_adapters/config/runtime-config-adapter.ts` | Bọc `chrome.storage` 1-1, config **động** | Fallback về build-config khi storage trống/hỏng |

- Config tĩnh (public, build-time) đi qua `build-config.ts`; config động (người dùng chỉnh, token tự nhập) đi qua `runtime-config-adapter.ts`.
- Không tạo file config nào ngoài 3 file trên. ℹ️ Kiến thức vị trí file — không có hook.

---

## 4. Quy tắc build & biến môi trường

- Build **fail cứng** khi thiếu biến `.env` bắt buộc theo `config-schema.ts`. ⚠️ Còn soft (CI — Zod validate, **CFG-2**).
- **Zero Placeholder**: cấm tuyệt đối AI hardcode giá trị "tạm" thay cho biến môi trường. ✅ Hook **G0-01** `gate_placeholder_pre.py` + **G0-02** `gate_placeholder_stop.py` (chặn ngay lúc ghi file).
- 3 file môi trường ở **root**: `.env.development`, `.env.staging`, `.env.production` — tương ứng các mode build/deploy. ℹ️ Kiến thức.
- `config-schema.ts` là nguồn định nghĩa biến bắt buộc **chung cho cả 3** file môi trường; không khai báo rải rác. ℹ️ Kiến thức.

---

## 5. Gates (nghiệm thu cơ học)

- **CFG-1**: Không có API key bên thứ 3 trong `dist/` sau build — scan regex (`sk-`, `AIza`...) trong `dist/` → **0 match**. 🔥 Hook **G1-08** `gate_secret_scan.py` (PostToolUse backstop sau lệnh build) + CI scan — ✅ Cơ học hóa.
- **CFG-2**: Build fail cứng khi thiếu biến `.env` bắt buộc — CI chạy build với `.env` cố ý thiếu 1 biến → **build đỏ** (negative test). ⚠️ Còn soft (CI only).

---

## 6. Reactivity, Error Handling & Cross-cutting

- **Reactivity / subscribe**: khi config runtime đổi, UI phải đồng bộ mà không cần reload — qua `chrome.storage.onChanged` hoặc `subscribe()` ở `runtime-config-adapter`. ℹ️ Kiến thức.
- **Error handling không throw**: 100% thao tác config trả về Result pattern (hoặc tương đương) — không ném `throw`. ⚠️ Convention nội bộ — không có hook, review thủ công.
- **Cross-cutting concern**: `config/` nằm vật lý trong Layer 2 (vì bọc `chrome.*`), **mọi layer khác được import dùng** — không phải Layer 5 đứng trên Layer 4. ℹ️ Kiến thức kiến trúc.
