---
trigger: glob
description: 'Quy chuẩn kiến trúc Storage chrome.storage (local/sync/session drivers) + State Persistence Layer (session-cache) + Ring Buffer Telemetry'
globs:
  [
    'src/2_platform_adapters/storage/**',
    'src/1_engine/background/state/**',
    'src/0_contracts/storage-schema.ts',
    'src/2_platform_adapters/telemetry/log-ring-buffer.ts',
  ]
---

# 💾 Rule: Storage chrome.storage & State Persistence Layer

> **Ghi chú rename**: File giữ tên cũ `database-and-indexeddb-storage.md` vì ổn định liên kết, nhưng nội dung đã viết lại hoàn toàn. Kiến trúc IndexedDB-first **KHÔNG còn hiệu lực** (xem §10 OUT-OF-SCOPE). Nguồn sự thật: `Docs/Setups/Architect-workspace/Architect-workspace.md` (§2, §4, §6.2, §6.3, §8, §9).

> ✅ **Trạng thái enforce:** cấm `console.log` trần (OBS-1), `traceId` bắt buộc (OBS-2) và Layer 3 cấm import `chrome` (ARC-2) đã được cơ học hóa thành hooks gate `G1-06` `gate_arch_boundary.py` + `G1-07` `gate_traceid.py` — chặn ngay lúc ghi file. Các mục còn lại đánh dấu ⚠️ vẫn là rule mềm. Chi tiết: `.agent/hooks/scripts/config/rules.yaml` + `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.

---

## 1. Tổng quan — vì sao Storage phải là kiến trúc riêng

Chrome Extension MV3 là hệ đa tiến trình; Service Worker bị Chrome **random kill sau ~30s idle** — không đảm bảo sống (Architect §2). Hệ quả trực tiếp: **không tin memory SW**, mọi state phải externalize ra `chrome.storage`; cần **State Persistence Layer** riêng biệt, không chỉ storage adapter chung chung (Architect §2, §1.2).

Mô hình gồm 2 vai trò:

- **Storage drivers** (`2_platform_adapters/storage/`) — bọc `chrome.*` 1-1, tầng vật lý.
- **Session cache** (`1_engine/background/state/session-cache.ts`) — đệm SW: nơi đổ state trước khi chết + rehydrate khi thức dậy.

---

## 2. Ba Storage Drivers (`src/2_platform_adapters/storage/`)

Mỗi driver bọc **1-1** API `chrome.storage` tương ứng (`get`/`set`/`remove`/`getBytesInUse`/`onChanged`), chỉ import type từ `0_contracts` (Layer 0) — không import từ module nghiệp vụ (Architect §4, §9). Unit test qua `@webext-core/fake-browser` (Architect §7).

| File                | API                      | Vai trò                                                                                                          | Giới hạn Chrome       |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| `local-driver.ts`   | `chrome.storage.local`   | Tầng bền vững — **nguồn sự thật**: token người dùng (encrypt nếu cần, Architect §6.3), dữ liệu nghiệp vụ durable | ~10MB                 |
| `sync-driver.ts`    | `chrome.storage.sync`    | Chỉ **preference không nhạy cảm** đồng bộ đa thiết bị; không đặt dữ liệu lớn/nhạy cảm                            | ~100KB tổng, 8KB/item |
| `session-driver.ts` | `chrome.storage.session` | Volatile — sống qua SW restart, **chết khi browser đóng**; chỉ dữ liệu **tái tạo được**                          | 10MB                  |

Phân loại ghi theo mục đích: durable + có giá trị lâu dài → `local`; tuỳ chỉnh người dùng muốn đồng bộ → `sync`; tạm thời, có thể tái tạo → `session`. Sai tầng = sai thiết kế (vd đặt state nghiệp vụ vào session thì browser đóng là mất).

---

## 3. State Persistence Layer — `session-cache.ts`

Đường dẫn: `src/1_engine/background/state/session-cache.ts` (Architect §4).

- SW bị kill ~30s idle → **không tin memory**; session cache dùng `chrome.storage.session` làm đệm cho SW.
- Trước khi SW chết (hook lifecycle / mỗi lần ghi state quan trọng): **đổ snapshot xuống session cache**; khi SW thức dậy: **rehydrate** từ cache.
- **Cache tạm KHÔNG phải nguồn sự thật** — nguồn sự thật là `chrome.storage.local`. Session cache chỉ là lớp đệm tái tạo được; khi mất (browser đóng), state phải được tái dựng từ `local`.
- Không biến session cache thành nơi lưu duy nhất của bất kỳ dữ liệu nào không thể tái tạo.

---

## 4. Quy tắc KHÔNG tin SW memory

- Mọi state phải externalize ra `chrome.storage` — biến toàn cục trong Background sống mãi là giả định sai (Architect §1.3).
- **DevTools mở giữ SW sống nhân tạo** → bug mất state không tái hiện khi debug; đừng dùng DevTools-mở làm chuẩn hành vi.
- Phải test kịch bản SW restart thật bằng Playwright (`context.serviceWorkers()`), không chỉ Vitest (Architect §7).
- Trước khi code, trả lời: "Nếu SW bị kill giữa lúc xử lý, state ở đâu và có mất dữ liệu không?" (Architect §12).

---

## 5. Popup không giữ business state (ADR-007)

- Popup chết ngay khi mất focus (Architect §2) → **không giữ business state trong React state** của popup.
- Popup chỉ là **view**: mỗi lần mở, fetch lại state từ storage **qua IPC** (Background → IPC Router → driver); đóng đột ngột không mất gì (ADR-007).

---

## 6. `storage-schema.ts` — nguồn sự thật duy nhất (Layer 0)

- Đường dẫn: `src/0_contracts/storage-schema.ts` (Architect §4).
- Type cho **TỪNG key** `chrome.storage` tại **1 file** — Background/Content/Popup là các process riêng giao tiếp qua JSON, sai type ở một đầu sẽ **fail âm thầm** ở đầu kia; tập trung type tại đây là cơ chế an toàn duy nhất (Architect §5 Layer 0, ADR-002).
- **Mọi key mới phải khai báo ở đây TRƯỚC khi dùng** — không rải type rải rác theo module.
- Driver nhận key kiểu literal từ schema → type-safe xuyên tầng.

---

## 7. Ring Buffer Telemetry — `log-ring-buffer.ts`

Đường dẫn: `src/2_platform_adapters/telemetry/log-ring-buffer.ts` (Architect §4).

- Mọi context log qua `logger.ts` → IPC `LOG_SINK` → Background → **Ring Buffer trên `chrome.storage.session`, cap N dòng** (Architect §6.2).
- **TTL = vòng đời phiên**: browser đóng = mất log — **chấp nhận** vì đây là telemetry/debug, không phải audit (ADR-003).
- Cần log bền → **mirror có cap** vào `local-driver`.
- Session cache và ring buffer **chia sẻ ngân sách 10MB** của `chrome.storage.session` → phân bổ quota rõ ràng (vd 6MB cache / 4MB log), **evict theo BYTE** qua `getBytesInUse`, không chỉ theo số bản ghi.
- Cấm `console.log` trần trong `src/` trừ chính `logger.ts` → ✅ **G1-06** `gate_arch_boundary.py` (console_log_regex + logger_file); mọi log kèm `traceId` → ✅ **G1-07** `gate_traceid.py` (PostToolUse backstop) + type-level (OBS-1/2).

---

## 8. Quy tắc ghi hiệu năng (kế thừa tinh thần file cũ — batch)

- ❌ **Cấm `set()` từng key trong vòng `for`** — mỗi batch = **1 lần `storage.set({...})`**.
- Mỗi lần set **≤ 60 key** (giới hạn event `onChanged` mỗi lần ghi).
- Gộp batch để tránh **rate limit ~120 writes/phút**.
- **Ước lượng byte + evict đủ TRƯỚC khi set** — quota exceeded sẽ fail **CẢ LÔ**, không phải từng key.

---

## 9. Fallback / Degradation (kế thừa tinh thần file cũ — fallback có cảnh báo)

- Gặp lỗi quota / lỗi ghi → **fallback tầng 1 = session storage**; tầng cuối = **memory SW** (ghi rõ **non-durable**, có thể mất khi SW bị kill).
- **Cảnh báo degradation qua `telemetry/logger.ts`** — không `console.log` trần, không văng unhandled exception. → ⚠️ Còn soft (không hook cho degradation pattern; phần `console.log` trần đã được **G1-06** cover).
- > Khuyến nghị thiết kế: Architect-workspace.md không đặc tả bậc thang fallback cụ thể; đây là đề xuất dựa trên giới hạn Chrome thực tế (quota 10MB session, ~120 writes/phút), không phải yêu cầu tài liệu.

---

## 10. IndexedDB — OUT-OF-SCOPE

- Hiện tại **không tạo IndexedDB driver**. Kiến trúc cũ (`indexeddb-adapter.ts`, FIFO 5.000 bản ghi/5MB/TTL 7 ngày/xóa 10%) **bị bãi bỏ** — thay bằng Ring Buffer session (§7) + ghi batch (§8).
- Nếu tương lai cần durable **>10MB**: thêm `indexeddbs-driver.ts` cùng interface với 3 driver, khai báo `unlimitedStorage`, **mở ADR mới** — không tự ý thêm khi chưa có ADR.

---

## 11. Ma trận quyền hạn ghi (Architect §8)

| Tầng/Context                      | Quyền ghi `chrome.storage`                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Background Script                 | ✅ Đầy đủ                                                                                                                                     |
| Content Script (Isolated)         | ⚠️ Hạn chế (`runtime`, `storage`, `i18n`) — chỉ ghi qua driver, không tự ý mở rộng                                                            |
| Content Script (Main World)       | ❌ Không có `chrome.*` — phải `postMessage` ngược qua `main-world-bridge.ts` — ✅ **G1-06** (post_message_regex + bridge_file) (Architect §9) |
| Popup/SidePanel/Options/Offscreen | ✅ Đầy đủ                                                                                                                                     |
| Layer 3 (`3_modules/`)            | ❌ Cấm import `chrome` — gọi driver **qua interface** — ✅ **G1-06** (chrome_regex + dom_regex) (ARC-2, Architect §8, §9)                     |

---

## 12. Xóa khỏi hệ thống

Bãi bỏ hoàn toàn (không dùng lại code): `src/infra/storage/indexeddb-adapter.ts`, `src/infra/storage/repository.ts`, `src/infra/storage/storage-fallback.ts`, `src/infra/logging/indexeddb-adapter.ts`, `src/infra/**` phục vụ storage cũ, `Data/Database/**`, `quick_zalo`. Khái niệm cũ — Evlog FIFO 5.000 bản ghi/5MB/TTL 7 ngày/xóa 10%/`bulkPut` — không áp dụng nữa.

---

## 13. Phân biệt yêu cầu tài liệu vs khuyến nghị

**Yêu cầu từ Architect-workspace.md**: không tin SW memory + State Persistence Layer (§2); 3 drivers + đường dẫn `session-cache.ts`/`storage-schema.ts`/`log-ring-buffer.ts` (§4); Ring Buffer `chrome.storage.session` cap N dòng + cấm `console.log` trần (§6.2); placement dữ liệu — token user → `local` encrypt nếu cần, preference → `sync`/`local` (§6.3); ma trận quyền hạn (§8); phụ thuộc tầng, `main-world-bridge.ts`, Layer 3 cấm chrome (ARC-2, §9).

**Khuyến nghị thiết kế dựa trên giới hạn Chrome thực tế (tài liệu không đặc tả)**: quota 10MB session, ~100KB sync / 8KB mỗi item, 60 key mỗi lần `set` (onChanged), ~120 writes/phút, phân bổ ngân sách 10MB session (cache vs log), evict theo byte, bậc thang fallback §9. Khi triển khai phải kiểm chứng con số trên Chrome thật.
