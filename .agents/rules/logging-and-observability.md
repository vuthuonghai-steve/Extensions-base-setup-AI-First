---
trigger: glob
description: 'Quy chuẩn kiến trúc Telemetry tập trung (logger.ts → IPC LOG_SINK → Ring Buffer → Broadcast → Debug Console) theo §6 Architect-workspace.md, ADR-003, OBS-1..3. Bắt buộc khi sửa telemetry/, log-schema.ts, debug-console-app/'
globs:
  [
    'src/2_platform_adapters/telemetry/**',
    'src/0_contracts/log-schema.ts',
    'src/4_presentation/extension-views/debug-console-app/**',
  ]
---

# 🪵 Rule: Telemetry — Logging & Observability

Rule này quy định chuẩn mực bắt buộc về ghi log cấu trúc, theo dõi runtime và tự debug (self-debugging) theo kiến trúc **Telemetry tập trung** (§6 + ADR-003 của `Architect-workspace.md`). Nguồn sự thật duy nhất cho schema log là `0_contracts/log-schema.ts` (Layer 0).

> ✅ **Trạng thái enforce:** cấm `console.log` trần (OBS-1) và `traceId` bắt buộc (OBS-2) đã được cơ học hóa thành hooks gate `G1-06` (`gate_arch_boundary.py`) + `G1-07` (`gate_traceid.py`) — chặn ngay lúc ghi file, không còn là rule "tự khai báo, tự kiểm". Các mục còn lại đánh dấu ⚠️ vẫn là rule mềm. Chi tiết: `.agent/hooks/scripts/config/rules.yaml` + `.agent/Docs/analys/hooks/rules-to-hooks-gate-list.md`.

## 1. Kiến trúc Telemetry tập trung

Log của **mọi execution context** được gom về một nơi duy nhất thay vì phân mảnh theo process (SW bị kill → log mất; Content Script log lẫn vào DevTools trang; Popup đóng → log biến mất):

```txt
Content(Isolated) ─┐
Content(MainWorld)─┤
Popup/SidePanel    ─┼─► logger.ts (mỗi context) ─► IPC "LOG_SINK" ─► Background
Offscreen          ─┤
Background chính   ─┘
                                                          │
                                          Ring Buffer (chrome.storage.session, cap N dòng)
                                                          │
                                          Broadcast qua Port → Debug Console Page
                                          (tail real-time, filter context/level/traceId, export JSON)
```

### Chuỗi thành phần (đúng tên file trong cây thư mục §4)

1. **`src/2_platform_adapters/telemetry/logger.ts`** — mỗi context có một instance logger riêng (Background, Content Isolated/Main, Popup/SidePanel, Offscreen). Là nơi **duy nhất** được phép gọi `console.*`.
2. **IPC `"LOG_SINK"`** — action message gửi log từ context đang chạy về Background (qua `MessageBus`/IPC sender, kèm `traceId` bắt buộc).
3. **`log-sink.ts`** (Background) — nhận log từ mọi context, validate theo `LogEntry`, chuyển xuống Ring Buffer.
4. **`log-ring-buffer.ts`** — persist vào `chrome.storage.session`, **cap N dòng** (FIFO, tràn thì xóa bản cũ nhất). `session` vì log là trạng thái phiên, không cần tồn tại qua khởi động trình duyệt.
5. **`log-broadcaster.ts`** — broadcast log mới tới các trang theo dõi qua **Port long-lived connection** (`2_platform_adapters/ipc/port-channel.ts`).
6. **Debug Console Page** — `1_engine/ui-pages/debug-console/index.html` + `src/4_presentation/extension-views/debug-console-app/`:
   - `LogViewer.tsx`: **tail real-time**, **filter theo context / level / traceId**.
   - `StorageInspector.tsx`: soi trực tiếp `chrome.storage` (session/local/sync).
   - `export-logs.ts`: **export JSON** toàn bộ log — cơ chế để AI Agent đọc log mà không cần mở trình duyệt quan sát thủ công (§6.1).

## 2. Quy tắc bắt buộc

- **Cấm `console.log` trần trong `src/`** (trừ chính `logger.ts`) — 🔥 Hook **G1-06** `gate_arch_boundary.py` (console_log_regex + logger_file) + ESLint (CI). → ✅ Cơ học hóa (OBS-1).
- **Mọi `MessageBus.send()` bắt buộc đính kèm `traceId`** — enforce ở **type level** (field bắt buộc, không optional) trong `0_contracts/ipc-payloads.ts`; build fail nếu thiếu field + 🔥 Hook **G1-07** `gate_traceid.py` (PostToolUse backstop). → ✅ Cơ học hóa (OBS-2).
- **`logger.ts` luôn ghi đồng thời** ra console gốc của context (debug F12 truyền thống vẫn dùng được) **và** gửi lên Log Sink. Không được chỉ chọn 1 trong 2. → ℹ️ Giữ nguyên (kiến thức kiến trúc — không enforce).
- **`trace-id.ts`** sinh correlation ID (UUIDv4) cho mỗi luồng xử lý; ID này truyền xuyên Content → Background → Storage để ghép log 3 tầng thành 1 câu chuyện nhân-quả (§6.1). → ℹ️ Giữ nguyên (kiến thức — không enforce).
- Log chạy nền (SW xử lý ngầm) **bắt buộc qua Log Sink + Ring Buffer** — không được chỉ ghi console vì log sẽ mất khi SW bị kill (§6.1.2, ADR-003). → ⚠️ Còn soft (chưa có hook).

## 3. LogEntry Schema — 7 trường bắt buộc

Định nghĩa **Type `LogEntry`** được chuyển về **`src/0_contracts/log-schema.ts`** (Layer 0 — nguồn sự thật duy nhất, không phụ thuộc ai). Mọi log entry từ `logger.ts` bắt buộc đủ 7 trường để hỗ trợ LLM Self-Debugging (< 3s RCA):

| Trường            | Mô tả & Định dạng                                          | Ví dụ                                                 |
| :---------------- | :--------------------------------------------------------- | :---------------------------------------------------- |
| `trace_id`        | Correlation ID — UUIDv4                                    | `"8f3a1b2c-9012-4e5f-b678-123456789abc"`              |
| `scope`           | Bounded context phát sinh log                              | `"bookmark-manager"`, `"telemetry"`, `"background"`   |
| `level`           | `DEBUG` / `INFO` / `WARN` / `ERROR` / `FATAL`              | `"ERROR"`                                             |
| `file_line`       | Tọa độ file:dòng phát sinh log                             | `"src/2_platform_adapters/telemetry/logger.ts:142"`   |
| `decision_reason` | Lý do nghiệp vụ / nguyên nhân sự cố bằng ngôn ngữ tự nhiên | `"Storage quota exceeded during batch write"`         |
| `payload`         | Metadata JSON đã **sanitize PII**                          | `{ "error_code": "QUOTA_EXCEEDED", "entries": 5000 }` |
| `timestamp`       | ISO-8601 UTC                                               | `"2026-07-27T05:30:00.000Z"`                          |

## 4. Quy tắc cấm (`must_not`)

- **`must_not`**: Tuyệt đối **KHÔNG dùng `console.log()` / `console.error()` rời rạc** trong mã nguồn sản phẩm — mọi log phải qua `logger.ts` — 🔥 Hook **G1-06** `gate_arch_boundary.py` (console_log_regex + logger_file) + ESLint. → ✅ Cơ học hóa (OBS-1).
- **`must_not`**: Tuyệt đối **KHÔNG ghi thông tin nhạy cảm** (mật khẩu, raw OTP, auth token) vào `payload`. Hàm sanitize PII tự động loại bỏ nhưng dev/agent phải có ý thức bảo mật khi đưa dữ liệu vào payload. → ⚠️ Còn soft (semantic — không thể hook).
- **`must_not`**: **KHÔNG nuốt ngoại lệ (silent catch)** — mọi `catch` bắt buộc gọi `logger.error(...)` qua `logger.ts` **hoặc** trả về `Result.err(...)` để lỗi đi vào luồng log/kiểm chứng. → ⚠️ Còn soft (không có hook — convention, review thủ công).

## 5. Self-Debugging Loop

1. Khi có lỗi trong CI/test: đọc log từ **Debug Console Page** (tail real-time) hoặc **export JSON** qua `export-logs.ts`.
2. Trích xuất chính xác `file_line` và `decision_reason` từ LogEntry.
3. Mở đúng vị trí code, sửa trực tiếp (< 3s RCA).
4. Re-verify: write-time hooks **G1-06**/**G1-07** đã chặn ngay lúc ghi file (OBS-1/2), sau đó chạy gate CI (OBS-3 + test suite) trước khi báo cáo hoàn tất.
