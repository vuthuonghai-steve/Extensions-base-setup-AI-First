# Negative Space — Giai đoạn 1 (Infrastructure & Base Configuration)

> Nguồn: `Docs/Setups/phase-1-setup-plan.md` §9 + `Architect-workspace.md` §1.3.
> Mỗi mục `must_not` kèm `consequence_of_violation` (NEG-1).

| #   | must_not                                                                                                        | consequence_of_violation                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Đặt secret/API key bên thứ 3 vào `.env.*` hay bất kỳ file nào trong repo                                        | Bundle luôn public, ai cũng unpack đọc plaintext → phát key miễn phí cho mọi người dùng (Architect §6.3, ADR-004)                     |
| 2   | Hardcode version khác bảng verified (phase-1-setup-plan.md §5)                                                  | Peer conflict giữa wxt/vite/eslint/ts → build vỡ không giải thích được                                                                |
| 3   | Tạo file config ngoài đúng 3 file quy định (`config-schema.ts`, `build-config.ts`, `runtime-config-adapter.ts`) | Phá "nguồn sự thật" config, rối vị trí file (config-and-environment §3)                                                               |
| 4   | Viết code nguồn thuộc Phase 2+ (contracts khác `config-schema.ts`, logic nghiệp vụ)                             | Vượt scope, phá Bottom-Up; `0_contracts/` chưa được duyệt đầy đủ (G0-03)                                                              |
| 5   | Dùng `eslint-plugin-react@7.37.5` với ESLint 10                                                                 | Peer range `^9.7` → lint crash/undefined behavior                                                                                     |
| 6   | Dùng TypeScript 7.x (`latest` trên npm)                                                                         | `typescript-eslint` peer `<6.1.0` + `dependency-cruiser` `<7.0.0` → toolchain gãy                                                     |
| 7   | Chạy `wxt init` trong thư mục đã có `src/`                                                                      | Hard-abort `process.exit(1)` — thư mục không rỗng                                                                                     |
| 8   | Bypass hook gate (`--no-verify`, né force_ask, `describe.only`...)                                              | Vi phạm DES-2/Stage-4/Stage-5 — gate deny, hợp đồng data vỡ âm thầm                                                                   |
| 9   | Đặt entrypoints ngoài `src/1_engine`                                                                            | Phá quy tắc tầng "1_engine là nơi DUY NHẤT chứa defineBackground/defineContentScript" — nhớ cấu hình đúng `entrypointsDir` (số nhiều) |
| 10  | Để `prebuild` chạy trước `wxt prepare` mà không có `.wxt/`                                                      | ESLint/tsconfig import file chưa sinh → crash khó chẩn đoán (R8)                                                                      |
