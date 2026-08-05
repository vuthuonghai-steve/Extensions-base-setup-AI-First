# MVP Viability Gate — Phases 1–3: Infrastructure, Layer 0 Contracts & Layer 2 Adapters

> Quyết định Stage 4 (Human-only) — chủ dự án duyệt, 2026-08-05. Chốt theo
> `Docs/Setups/phase-1-setup-plan.md` §10 (Q1–Q4).

## GO

**GO — MVP khả thi để triển khai Giai đoạn 1** (chủ dự án: vuthuonghai-steve):

- Q1: package manager = pnpm (pin `packageManager: pnpm@10.32.1`).
- Q2: TypeScript = `~6.0.3` (không 7.x — peer typescript-eslint/dependency-cruiser).
- Q3: commit 3 file `.env.*` — chỉ config public, không secret.
- Q4: shell background tối thiểu (`src/1_engine/background/index.ts`) để `pnpm build` xanh.

## Scope Phase 1 & Phase 2

- **Phase 1**: WXT config, dependencies, TS config, ESLint/Prettier, Zod schema `.env` + 3 file môi trường.
- **Phase 2 (GO - Layer 0 Contracts)**: `src/0_contracts/` (ipc-actions, ipc-payloads, log-schema, storage-schema, domain-entities nếu cần) + `tests/contract/ipc-payload-shape.spec.ts`. Hạ tầng D1–D9 theo Phase 2 Setup Plan.

## GO — Phase 3: Layer 2 Platform Adapters & Cross-cutting Services

**GO — MVP khả thi để triển khai Giai đoạn 3** (chủ dự án: vuthuonghai-steve, duyệt 2026-08-05 theo `Docs/Setups/phase-3-setup-plan.md` §3 D1–D10, §8 Q1–Q4):

- **Phạm vi 4 domain** (D1): `telemetry/` (5 file), `config/` (2 file), `storage/` (3 driver), `ipc/` (4 file) trong `src/2_platform_adapters/`. Defer `tabs/`/`scripting/`/`permissions/`/`declarative-net/` tới phase có consumer thật.
- **D3**: thêm manifest permission `storage` vào `wxt.config.ts`.
- **Chỉ import** từ `0_contracts` + `wxt/browser` (global chrome); cấm đụng `0_contracts/` (G0-03) — contract hiện tại đủ.
- Test unit tại `tests/unit/2_platform_adapters/` qua fake-browser — 0 dependency mới.
- **Không** viết logic nghiệp vụ Phase 4+ (modules), không build adapter ngoài 4 domain trên.

## Fail criteria (thoát sớm)

- `pnpm typecheck && pnpm lint` không 0 lỗi sau T9.
- CFG-2 negative test (T7) không làm build đỏ khi thiếu biến bắt buộc.
