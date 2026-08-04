# 📚 Standard Streams (`stdin`, `stdout`, `stderr`) in System Layer & AI Agent Collaboration

Tài liệu lưu trữ kiến thức chuẩn về 3 luồng giao tiếp (`stdin`, `stdout`, `stderr`) ở tầng hệ thống và cơ chế tương tác với các trợ lý AI Agent.

---

## 1. Định nghĩa File Descriptor (FD) & Standard Streams

### Khái niệm FD (File Descriptor là gì?)

- **FD** là viết tắt của **File Descriptor** (dịch nghĩa: _Mô tả File_ hoặc _Mã chỉ số File_).
- Trong hệ điều hành Unix/Linux có triết lý nổi tiếng: _"Everything is a file"_ (Mọi thứ đều được xem là file). Do đó, luồng màn hình, bàn phím, file đĩa cứng hay socket mạng đều được Hệ điều hành quản lý như một file.
- **Ý nghĩa & Vai trò của FD**: FD là một **con số nguyên không âm** (`0`, `1`, `2`, `3`,...) đại diện cho một luồng I/O đang mở của tiến trình. Khi một chương trình muốn đọc/ghi dữ liệu, nó chỉ cần gọi con số FD tương ứng, Hệ điều hành (Kernel) sẽ tự động dẫn dữ liệu tới đúng thiết bị hoặc file.

### 3 Chỉ số FD cố định (Standard Streams)

Mọi tiến trình khi khởi tạo luôn được Hệ điều hành mặc định gán 3 con số FD đầu tiên:

| File Descriptor (FD) | Tên viết tắt | Tên đầy đủ             | Vai trò & Chức năng                                                                                    |
| :------------------: | :----------- | :--------------------- | :----------------------------------------------------------------------------------------------------- |
|       **`0`**        | **`stdin`**  | Standard Input         | **Luồng nhận dữ liệu đầu vào** (từ bàn phím, file, hoặc lệnh phía trước truyền qua pipe `\|`).         |
|       **`1`**        | **`stdout`** | Standard Output        | **Luồng đầu ra chuẩn**, chứa dữ liệu/kết quả hoạt động **thành công và bình thường** của chương trình. |
|       **`2`**        | **`stderr`** | Standard Error         | **Luồng đầu ra thông báo lỗi**, chứa **cảnh báo (warning), thông báo lỗi (error) và stack trace**.     |
|   `3`, `4`, `5`...   | _Custom FDs_ | Opened Files / Sockets | Dành cho các file hoặc kết nối mạng mà ứng dụng tự mở thêm trong quá trình chạy.                       |

---

## 2. Nguyên lý Vận hành & Cơ chế Kỹ thuật ở Tầng Hệ Thống

### a. Tách biệt Dữ liệu (Data) và Log Chẩn đoán (Diagnostics)

- **Đường ống Pipe (`\|`)**: Các lệnh nối tiếp nhau trong terminal mặc định chỉ đọc dữ liệu từ **`stdout` (FD 1)** của lệnh trước.
- Việc tách **`stderr` (FD 2)** giúp các thông báo lỗi hoặc warning không làm hỏng cấu trúc dữ liệu sạch (như JSON, CSV, XML) mà `stdout` đang xuất ra.

### b. Cơ chế Bộ đệm (Buffering Mechanism)

- **`stdout` (Line-Buffered / Block-Buffered)**: Dữ liệu được gom vào bộ đệm RAM, chỉ xả (flush) ra màn hình hoặc file khi bộ đệm đầy hoặc gặp ký tự xuống dòng `\n` để tối ưu hiệu năng I/O.
- **`stderr` (Unbuffered)**: **Không sử dụng bộ đệm**. Mọi ký tự ghi vào `stderr` được Hệ điều hành đẩy thẳng ra màn hình ngay lập tức. Đảm bảo nếu chương trình crash bất ngờ thì dòng log lỗi không bị kẹt lại trong RAM.

---

## 3. Cú pháp Điều hướng Luồng trong Shell (Stream Redirection)

| Thao tác Redirection         | Cú pháp Terminal         | Ý nghĩa kỹ thuật                                                           |
| :--------------------------- | :----------------------- | :------------------------------------------------------------------------- |
| **Ghi stdout vào file**      | `command > output.txt`   | Lưu kết quả thành công vào file (ngầm định `1>`).                          |
| **Ghi stderr vào file**      | `command 2> error.log`   | Chỉ lưu thông báo lỗi/warning vào file riêng.                              |
| **Nối stdout vào cuối file** | `command >> output.txt`  | Ghi thêm dữ liệu thành công mà không đè nội dung cũ.                       |
| **Gộp stderr vào stdout**    | `command > all.log 2>&1` | Chuyển hướng luồng `2` (`stderr`) đi cùng vị trí với luồng `1` (`stdout`). |
| **Truyền stdin từ file**     | `command < input.txt`    | Nạp dữ liệu từ file vào luồng đầu vào `0` (`stdin`).                       |

---

## 4. Cơ chế tương tác giữa AI Agent và Standard Streams

Khi AI Agent thực thi lệnh terminal hoặc shell script:

1. **Thu thập Luồng Đôi (`stdout` + `stderr`)**: Agent lắng nghe đồng thời cả `stdout` (FD 1) và `stderr` (FD 2) phát ra từ tiến trình.
2. **Xử lý Thành công (`stdout`)**: Lấy dữ liệu kết quả thực thi (danh sách file, kết quả build, dữ liệu JSON).
3. **Chẩn đoán Lỗi (`stderr`)**: Khi lệnh thất bại hoặc xuất hiện warning, Agent đọc chính xác nội dung từ `stderr` (stack trace, line number) để tự động sửa lỗi.
4. **Tương tác qua `stdin`**: Đối với các lệnh yêu cầu nhập dữ liệu/xác nhận interactive, Agent gửi chuỗi input thông qua luồng `stdin` (FD 0).

---

## 5. Cơ chế Ghi Log Debug trong LLM Agent Tools (Stream Interception & Teeing)

Hầu hết các công cụ LLM CLI hiện nay (Claude Code, Antigravity, OpenCode, Codex CLI,...) khi bật chế độ Debug đều hoạt động dựa trên cơ chế bắt luồng **`stdout` / `stderr`** ở tầng hệ thống:

```
           [Subprocess / Tool Execution]
             │ (stdout / stderr raw)
             ▼
      ┌──────────────┐
      │  Stream Tee  │  (Tách/Phân nhánh dữ liệu)
      └──────┬───────┘
             │
             ├───► Terminal Screen (Giao diện hiển thị người dùng - UI Prettified)
             │
             └───► Debug Log File Appender (Ghi toàn bộ stdout, stderr, API Payloads vào file log)
```

### Nguyên lý hoạt động chi tiết:

1. **Parent-Child Process Interception**: Khi CLI khởi tạo một sub-process (tiến trình con) để chạy tool, nó chặn bắt luồng `stdout` (FD 1) và `stderr` (FD 2) của sub-process đó.
2. **Kỹ thuật Stream Teeing (Tách luồng)**: Tương tự lệnh `tee` trong Unix, luồng dữ liệu được chia làm 2 nhánh:
   - **Nhánh UI Terminal**: Được lọc bớt (format đẹp) để hiển thị trên màn hình người dùng.
   - **Nhánh Debug Logger**: Giữ nguyên raw `stdout`, `stderr`, kèm theo API JSON payloads (Prompt input, LLM responses, Tool parameters, System Hooks), rồi ghi nối tiếp (`append`) vào file log đĩa cứng (như `debug.log` hoặc `transcript.jsonl`).
3. **Lợi ích**: Giúp developer rà soát được toàn bộ lịch sử hoạt động, kiểm tra các dòng `stdout`/`stderr` bị ẩn, và truy vết nguyên nhân lỗi khi Agent chạy sai mà không làm rối màn hình làm việc chính.
