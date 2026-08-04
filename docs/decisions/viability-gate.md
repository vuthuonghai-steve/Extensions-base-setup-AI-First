# MVP Viability Gate — Phase 1: Infrastructure & Base Configuration

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
- **Không** viết logic nghiệp vụ Phase 3+ (platform adapters, modules, engine background logic).

## Fail criteria (thoát sớm)

- `pnpm typecheck && pnpm lint` không 0 lỗi sau T9.
- CFG-2 negative test (T7) không làm build đỏ khi thiếu biến bắt buộc.
