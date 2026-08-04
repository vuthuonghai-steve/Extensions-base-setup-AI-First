# Kế hoạch Setup Giai đoạn 1 — Infrastructure & Base Configuration

> **Trạng thái:** ✅ **APPROVED** — quyết định kỹ thuật §10 đã được chủ dự án chốt (2026-08-05). Sẵn sàng thực thi theo §7 (T0→T10).
> **Vai trò:** AI Product & Development Agent theo `Docs/Trade-offs/AGENTS.md` (8-Stage Pipeline, Cognitive Depth, Binary Gates).
> **Nguồn sự thật:** `Architect-workspace.md` (§6.3 Config, §11 Gates) · `temps_phase.md` (Phase 1) · `.agent/rules/*` (config-and-environment, tech-stack-and-conventions, code-quality-and-gates, wxt-extension-architecture).
> **Ngày khảo sát:** 2026-08-05 — mọi version được verify trực tiếp từ npm registry + wxt.dev (xem §5).

---

## 1. Mục tiêu

Hoàn tất hạ tầng để **build/bundler/alias/type-check/lint hoạt động chuẩn xác 100% trước khi viết code nguồn** (theo `temps_phase.md` Giai đoạn 1): WXT config, dependencies, TypeScript config, ESLint/Prettier (cấm `console.log` trần), Zod schema cho `.env` + 3 file môi trường.

## 2. Hiện trạng đã khảo sát (Constraint Anchoring — S4)

| Hạng mục                                                      | Hiện trạng                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/`                                                        | Skeleton rỗng: `0_contracts/ 1_engine/ 2_platform_adapters/ 3_modules/ 4_presentation/` (không file)                                                                                                                                                                                             |
| `tests/`                                                      | Skeleton rỗng: `contract/ e2e/ unit/` (không file)                                                                                                                                                                                                                                               |
| `package.json` / `wxt.config.ts` / `tsconfig.json` / `.env.*` | ❌ Không tồn tại (greenfield)                                                                                                                                                                                                                                                                    |
| Node / pnpm / npm                                             | `v22.23.1` ✓ (WXT yêu cầu ≥22) / `10.32.1` / `10.9.8`                                                                                                                                                                                                                                            |
| Hooks gate active                                             | `G0-04` (deny ghi `src/` nếu thiếu GO doc) · `G0-03` (force_ask `0_contracts/`) · `G1-06` (arch boundary) · `G0-01/02` (placeholder) · `G1-07` (traceId) · `G1-08` (secret scan) · `G0-06` (stop verify) · `G2-01..04` (evidence → continue) · `G1-01..04` (doc structure → skip nếu thiếu file) |
| `.gitignore`                                                  | ✅ Đã loại `.env`/`.env.local`/`.env.*.local`/`*.env`, WXT outputs, `.omo`/`.codegraph` — **`.env.development/.env.staging/.env.production` KHÔNG bị ignore** (public config commit được)                                                                                                        |
| Branch theo `.txt`                                            | `setup/phase-1-infra-config`                                                                                                                                                                                                                                                                     |

## 3. Quyết định kỹ thuật (ADR mini — Stage 3 tinh chỉnh)

| #       | Quyết định                                                                                            | Lý do (ràng buộc)                                                                                                                                                             | Nguồn                              |
| ------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **D1**  | **Manual scaffold — KHÔNG dùng `wxt init`**                                                           | `wxt init` **hard-abort** nếu thư mục đích không rỗng; `src/` skeleton đã tồn tại → dir không rỗng                                                                            | `initialize.ts` (wxt-dev/wxt)      |
| **D2**  | `srcDir: 'src'` trong `wxt.config.ts`                                                                 | WXT default `srcDir = root` → sẽ tìm `entrypoints/` ở root; kiến trúc khóa mọi thứ dưới `src/`                                                                                | `resolve-config.ts`                |
| **D3**  | **TypeScript `~6.0.3` (KHÔNG dùng 7.0.2)**                                                            | `typescript-eslint@8.66` peer `<6.1.0`; `dependency-cruiser@18.1.1` transpiler `<7.0.0`; WXT tự build với `^6.0.3`                                                            | dist-tags npm + peers              |
| **D4**  | ESLint 10 (flat config) + `typescript-eslint@8.66`                                                    | WXT peer `eslint ^8.57                                                                                                                                                        |                                    | ^9  |     | ^10`✓;`eslint-plugin-react@7.37.5`**KHÔNG** support ESLint 10 → bỏ, dùng`react-hooks@7.1.1`+`react-refresh@0.5.3` | peers npm |
| **D5**  | Zod **4.4.3**                                                                                         | v4 stable trên `latest` (v3 chỉ còn maintenance)                                                                                                                              | npm registry                       |
| **D6**  | Vitest 4.1.10 + plugin `WxtVitest()`                                                                  | WXT tích hợp sẵn; `@webext-core/fake-browser@2.0.1` đã là dep của wxt → dùng qua `wxt/testing/fake-browser`, **không cài riêng**                                              | `wxt/testing/vitest-plugin`        |
| **D7**  | Env prefix `WXT_`/`VITE_`; `.env.[mode]` ở root; đọc env build-time qua **manifest function-form**    | WXT load `.env` **SAU** khi config được eval; `ConfigEnv` chỉ có `{command, browser, manifestVersion, mode}` — không có env object                                            | environment-variables docs         |
| **D8**  | **pnpm** làm package manager (pin `packageManager: pnpm@10.32.1`)                                     | pnpm 10.32.1 có sẵn; WXT hỗ trợ đầy đủ                                                                                                                                        | —                                  |
| **D9**  | `entrypointsDir: resolve('src/1_engine')`                                                             | Entrypoints theo kiến trúc nằm ở `src/1_engine/**` (background/content/offscreen/ui-pages) — absolute path né ambiguity resolve theo srcDir; **cần smoke test xác nhận** (R3) | wxt-extension-architecture rule §3 |
| **D10** | Pin **exact version** cho wxt/vite/ts/eslint (không `^`); `^` chỉ cho types/vitest/plugin phụ         | Chống version drift làm vỡ peerDeps giữa các lần install                                                                                                                      | —                                  |
| **D11** | CFG-2 cơ học hóa bằng `scripts/validate-env.ts` chạy qua `prebuild`/`predev` (Node 22 type-stripping) | WXT không có cơ chế fail-hard env sẵn; script đọc `.env.<mode>` + Zod `config-schema.ts` → exit 1 khi thiếu biến                                                              | config-and-environment rule §4     |

## 4. Reverse Probing (S2) — rủi ro & phòng ngừa

| #   | Rủi ro                                                                               | Khả năng           | Phòng ngừa                                                                                                 |
| --- | ------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| R1  | **G0-04 deny** khi ghi file `src/` (kể cả `config-schema.ts`) nếu chưa có GO         | Chắc chắn          | **Task 0**: tạo `docs/decisions/viability-gate.md` chứa `GO` **trước** mọi write vào `src/`                |
| R2  | **G0-03 force_ask** khi ghi `0_contracts/`                                           | Chắc chắn          | Dự kiến bước hỏi duyệt của user; tuyệt đối không bypass                                                    |
| R3  | WXT không nhận entrypoint lồng sâu (`src/1_engine/background/index.ts`)              | Trung bình         | Smoke build sớm (Task 6); fallback: flatten layout hoặc đổi `entrypointDir`                                |
| R4  | **G0-06 "continue"** nếu lượt cuối không có lệnh verify                              | Chắc chắn nếu quên | Task cuối luôn chạy `typecheck && lint && test && build`                                                   |
| R5  | **G2-01..04 "continue"** sau khi tạo GO doc (thiếu deploy/monitoring/legal evidence) | Chắc chắn          | **Chấp nhận** — evidence thuộc Phase 5–6; gate chỉ emit `continue` (không deny), executor không hoang mang |
| R6  | Build đỏ vì thiếu biến `.env` bắt buộc                                               | Chủ ý (CFG-2)      | Schema chỉ khai báo biến thực sự cần (Zero Placeholder)                                                    |
| R7  | Version drift giữa các lần install                                                   | Trung bình         | D10 — pin exact version                                                                                    |
| R8  | ESLint crash nếu `.wxt/` chưa sinh (autoImports import fail)                         | Cao                | `prepare: wxt prepare` (pnpm tự chạy sau install); chạy `pnpm prepare` trước `pnpm lint` lần đầu           |
| R9  | `negative-space.md` thiếu ≥5 mục → G1-01 deny ở Stop                                 | Nếu tạo            | Viết đủ cấu trúc ngay từ đầu (§9)                                                                          |
| R10 | Đặt secret vào `.env`                                                                | Cấm tuyệt đối      | §9 Negative Space + G1-08 scan `dist/` + chỉ config public trong `.env.*` commit                           |

## 5. Dependency plan — verified 2026-08-05 (npm registry + wxt.dev)

| Package                             | Pin                    | Vai trò                                                | Source                                                        |
| ----------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `wxt`                               | `0.21.3`               | Framework                                              | https://registry.npmjs.org/wxt/latest                         |
| `@wxt-dev/module-react`             | `1.2.2`                | React module                                           | https://registry.npmjs.org/@wxt-dev/module-react/latest       |
| `vite`                              | `8.2.0`                | Bundler                                                | https://registry.npmjs.org/vite/latest                        |
| `react` / `react-dom`               | `19.2.8`               | UI                                                     | https://registry.npmjs.org/react/latest                       |
| `@types/react` / `@types/react-dom` | `^19.2.18` / `^19.2.3` | Types                                                  | https://registry.npmjs.org/@types/react/latest                |
| `typescript`                        | `~6.0.3` ⚠️ không 7.x  | Ngôn ngữ                                               | https://registry.npmjs.org/-/package/typescript/dist-tags     |
| `eslint`                            | `10.8.0`               | Linter                                                 | https://registry.npmjs.org/eslint/latest                      |
| `@eslint/js`                        | `10.0.1`               | Base rules                                             | https://registry.npmjs.org/@eslint/js/latest                  |
| `typescript-eslint`                 | `8.66.0`               | TS rules                                               | https://registry.npmjs.org/typescript-eslint/latest           |
| `eslint-plugin-react-hooks`         | `7.1.1`                | Hooks rules                                            | https://registry.npmjs.org/eslint-plugin-react-hooks/latest   |
| `eslint-plugin-react-refresh`       | `0.5.3`                | Fast-refresh                                           | https://registry.npmjs.org/eslint-plugin-react-refresh/latest |
| `eslint-config-prettier`            | `10.1.8`               | Tắt rule xung đột Prettier                             | https://registry.npmjs.org/eslint-config-prettier/latest      |
| `prettier`                          | `3.9.6`                | Formatter                                              | https://registry.npmjs.org/prettier/latest                    |
| `vitest`                            | `4.1.10`               | Unit test                                              | https://registry.npmjs.org/vitest/latest                      |
| `happy-dom`                         | `^20.8.3`              | DOM env cho component test (Phase 5)                   | WXT devDeps                                                   |
| `zod`                               | `4.4.3`                | Validate `.env` (config-schema)                        | https://registry.npmjs.org/zod/latest                         |
| `dependency-cruiser`                | `18.1.1`               | ARC-1 layer boundary (CI)                              | https://registry.npmjs.org/dependency-cruiser/latest          |
| `@playwright/test` + `playwright`   | `1.62.1`               | E2E (Phase 6 — cài sẵn)                                | https://registry.npmjs.org/@playwright/test/latest            |
| `web-ext`                           | `^10.5.0`              | Browser runner cho `wxt dev`                           | Template react                                                |
| `@webext-core/fake-browser`         | ❌ không cài riêng     | Đã là dep của wxt, dùng qua `wxt/testing/fake-browser` | WXT deps                                                      |

### `package.json` (đề xuất hoàn chỉnh)

```jsonc
{
  "name": "my-wxt-extension",
  "type": "module",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@10.32.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "prepare": "wxt prepare",
    "predev": "node --experimental-strip-types scripts/validate-env.ts --mode development",
    "dev": "wxt -m development",
    "prebuild": "node --experimental-strip-types scripts/validate-env.ts --mode production",
    "build": "wxt -m production build",
    "build:staging": "pnpm prebuild-staging && wxt -m staging build",
    "prebuild-staging": "node --experimental-strip-types scripts/validate-env.ts --mode staging",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "arc1": "depcruise src --config .dependency-cruiser.js",
    "zip": "wxt zip",
  },
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "4.4.3",
  },
  "devDependencies": {
    "wxt": "0.21.3",
    "@wxt-dev/module-react": "1.2.2",
    "vite": "8.2.0",
    "typescript": "~6.0.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.3",
    "web-ext": "^10.5.0",
    "eslint": "10.8.0",
    "@eslint/js": "10.0.1",
    "typescript-eslint": "8.66.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.3",
    "eslint-config-prettier": "10.1.8",
    "prettier": "3.9.6",
    "vitest": "4.1.10",
    "happy-dom": "^20.8.3",
    "dependency-cruiser": "18.1.1",
    "@playwright/test": "1.62.1",
    "playwright": "1.62.1",
  },
}
```

## 6. Nội dung từng file cấu hình (draft — quyết định hoàn chỉnh)

### 6.1 `wxt.config.ts`

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src', // D2 — skeleton nằm dưới src/
  entrypointsDir: resolve('src/1_engine'), // D9 — absolute path, né ambiguity relative-to-srcDir
  modules: ['@wxt-dev/module-react'], // D4/D5 stack
  alias: {
    '@contracts': resolve('src/0_contracts'),
    '@engine': resolve('src/1_engine'),
    '@platform': resolve('src/2_platform_adapters'),
    '@modules': resolve('src/3_modules'),
    '@presentation': resolve('src/4_presentation'),
  },
  imports: { eslintrc: { enabled: true } }, // sinh .wxt/eslint-auto-imports.mjs (auto theo ESLint ≥9)
  manifest: () => ({
    // D7 — function-form để đọc env sau khi .env load
    name: import.meta.env.WXT_APP_NAME,
    description: import.meta.env.WXT_APP_DESCRIPTION,
    version: '0.1.0',
    permissions: [], // permission tối thiểu — bổ sung theo phase
  }),
});
```

> ⚠️ `resolve()` từ `node:path` giải theo project root (CWD) — verify bằng smoke build (R3).

### 6.2 `tsconfig.json`

```jsonc
{
  "extends": "./.wxt/tsconfig.json", // wxt prepare sinh paths từ alias tự động — 1 nguồn sự thật
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
  },
}
```

### 6.3 `eslint.config.mjs` (flat config — OBS-1/TYP-1/ARC-2)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier/flat';
import autoImports from './.wxt/eslint-auto-imports.mjs'; // wxt prepare sinh — cần chạy trước

export default [
  { ignores: ['.wxt/**', '.output/**', 'dist/**', 'node_modules/**', 'coverage/**'] },
  autoImports,
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error', // TYP-1 (lớp ESLint)
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // OBS-1: cấm console.log trần...
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
  {
    // ...trừ telemetry/logger.ts
    files: ['**/telemetry/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier, // LUÔN cuối cùng
];
```

### 6.4 `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()], // polyfill browser (fake-browser) + alias từ wxt.config.ts + auto-imports
});
```

### 6.5 `.dependency-cruiser.js` (ARC-1)

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'arc-1: contracts-khong-ngo',
      from: { path: '^src/0_contracts' },
      to: { path: '^src/(1_engine|2_platform_adapters|3_modules|4_presentation)' },
    },
    {
      name: 'arc-1: platform-khong-ngo',
      from: { path: '^src/2_platform_adapters' },
      to: { path: '^src/(1_engine|3_modules|4_presentation)' },
    },
    {
      name: 'arc-1: modules-khong-ngo',
      from: { path: '^src/3_modules' },
      to: { path: '^src/(1_engine|2_platform_adapters|4_presentation)' },
    },
    {
      name: 'arc-1: engine-khong-ngo',
      from: { path: '^src/1_engine' },
      to: { path: '^src/(3_modules|4_presentation)' },
    },
  ],
};
```

### 6.6 `src/0_contracts/config-schema.ts` (Layer 0 — Zod, CFG-2)

```ts
import { z } from 'zod';

export const envSchema = z.object({
  WXT_APP_NAME: z.string().min(1, 'WXT_APP_NAME là bắt buộc'),
  WXT_APP_DESCRIPTION: z.string().min(1, 'WXT_APP_DESCRIPTION là bắt buộc'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(raw); // throw ZodError khi thiếu biến → exit 1 (CFG-2)
}
```

### 6.7 `scripts/validate-env.ts` (cơ chế fail-hard CFG-2 — chạy qua `prebuild`)

```ts
import { readFileSync } from 'node:fs';
import { validateEnv } from '../src/0_contracts/config-schema.ts';

const mode = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'development';
const file = `.env.${mode}`;
const raw = readFileSync(file, 'utf-8'); // throw nếu thiếu file
const vars: Record<string, string> = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
validateEnv(vars);
console.log(`[env] ${file} hợp lệ (${Object.keys(vars).length} biến)`);
```

> Lưu ý: `console.log` trong `scripts/` **ngoài** `src/` — không vi phạm OBS-1 (ESLint scoped vào src; hook G1-06 chỉ quét TargetFile — script không nằm trong `src/`). Nếu muốn chặt hơn, chuyển sang `process.stdout.write`.

### 6.8 `.env.development` / `.env.staging` / `.env.production`

Chỉ config **public** (không secret — xem §9). Đặt giá trị thật, không placeholder:

```dotenv
WXT_APP_NAME=My WXT Extension
WXT_APP_DESCRIPTION=Chrome Extension MV3 theo kiến trúc 5 tầng (WXT + React)
```

> Mỗi file môi trường đặt giá trị riêng theo môi trường (suffix ` (dev)` / ` (staging)` / rỗng cho prod tùy chuẩn tên sản phẩm).

### 6.9 Shell tối thiểu cho smoke build (chờ Q4)

`src/1_engine/background/index.ts` — bootstrap rỗng để WXT build có ≥1 entrypoint (không logic nghiệp vụ):

```ts
import { defineBackground } from '#imports';

export default defineBackground(() => {
  // Shell bootstrap hạ tầng — listener sẽ lắp ở Phase 5 (Layer 1 Engine)
});
```

### 6.10 Files phụ trợ

- `.nvmrc` → `22`
- `.prettierrc` → `{ "semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }`
- `docs/decisions/viability-gate.md` → nội dung chứa `GO` (Task 0, unblock G0-04)
- `docs/negative-space.md` → §9 (≥5 mục kèm hậu quả — G1-01)

## 7. Trình tự thực thi (task + gate từng bước)

> Mỗi task: tạo → verify cơ học → chỉ chuyển task kế khi gate xanh. Nguyên tắc Root Cause First (AGENTS.md).

| #   | Task                                                                                                                  | Deliverable                                  | Verify / Gate                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| T0  | `git checkout -b setup/phase-1-infra-config` + tạo `docs/decisions/viability-gate.md` (GO) + `docs/negative-space.md` | Branch + 2 docs                              | G0-04 unblock; G1-01 pass (≥5 mục + "hậu quả")                             |
| T1  | `package.json` (D8-D11) + `pnpm install`                                                                              | lockfile `pnpm-lock.yaml`, `.wxt/` (prepare) | Install exit 0; `pnpm prepare` chạy OK                                     |
| T2  | `wxt.config.ts` + `tsconfig.json` + `.nvmrc` + `vitest.config.ts`                                                     | 4 files                                      | `pnpm typecheck` exit 0                                                    |
| T3  | `eslint.config.mjs` + `.prettierrc` + `.dependency-cruiser.js`                                                        | 3 files                                      | `pnpm lint` exit 0 (chưa có source → pass)                                 |
| T4  | `src/0_contracts/config-schema.ts` + `scripts/validate-env.ts` + 3 file `.env.*`                                      | Config contracts                             | **G0-03 force_ask** (user duyệt) · G1-06 (không console/as any trong src/) |
| T5  | `tests/unit/config-schema.spec.ts` + `tests/unit/smoke.spec.ts` (verify alias `@contracts`)                           | 2 test thật                                  | `pnpm test` xanh                                                           |
| T6  | Shell entrypoint tối thiểu (Q4=yes) + smoke build                                                                     | `.output/chrome-mv3`                         | `pnpm build` exit 0 (R3 verify entrypoint + alias + env)                   |
| T7  | **CFG-2 negative test**: tạm ẩn `WXT_APP_NAME` trong `.env.production` → `pnpm build` phải **đỏ** → khôi phục         | Bằng chứng fail-hard                         | CFG-2 pass (build đỏ đúng ý)                                               |
| T8  | CFG-1: `pnpm build` lại → G1-08 tự scan `dist/`                                                                       | 0 match secret                               | CFG-1 pass                                                                 |
| T9  | Verify tổng: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (BASE-0) → commit                               | Evidence log                                 | **G0-06**: lượt cuối có verify command                                     |
| T10 | Report: bảng gate pass/fail + cập nhật `temps_phase.md` (checklist Phase 1 done)                                      | Report                                       | Human review                                                               |

## 8. Gates nghiệm thu Phase 1 (checklist nhị phân)

| Gate                        | Pass criteria                                                     | Trạng thái dự kiến       |
| --------------------------- | ----------------------------------------------------------------- | ------------------------ |
| **BASE-0**                  | `pnpm typecheck && pnpm lint` 0 lỗi                               | ✅ sau T9                |
| **CFG-2**                   | Build thiếu 1 biến bắt buộc → **đỏ** (negative test T7)           | ✅ sau T7                |
| **CFG-1**                   | `dist/` 0 match secret pattern                                    | ✅ sau T8 (G1-08)        |
| **OBS-1**                   | 0 `console.log` trần ngoài `telemetry/logger.ts` (ESLint + G1-06) | ✅ toàn phase            |
| **TYP-1**                   | 0 `as any` / `@ts-ignore`                                         | ✅ toàn phase            |
| **ARC-1**                   | `pnpm arc1` (depcruise) 0 vi phạm trên config                     | ✅ (chưa có source sâu)  |
| **ZPL-1**                   | 0 placeholder trong `src/`                                        | ✅ toàn phase (G0-01/02) |
| **G0-03/G0-04/G1-06/G1-07** | Hooks pass trong quá trình ghi file                               | ✅ toàn phase            |
| **G0-06**                   | Lượt cuối có verify command                                       | ✅ sau T9                |

## 9. Negative Space Giai đoạn 1 (must_not + hậu quả — NEG-1)

| `must_not`                                                                                                      | `consequence_of_violation`                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Đặt secret/API key bên thứ 3 vào `.env.*` hay bất kỳ file nào trong repo                                        | Bundle luôn public, ai cũng unpack đọc plaintext → phát key miễn phí cho mọi người dùng (§6.3, ADR-004)                               |
| Hardcode version khác bảng verified (§5)                                                                        | Peer conflict giữa wxt/vite/eslint/ts → build vỡ không giải thích được                                                                |
| Tạo file config ngoài đúng 3 file quy định (`config-schema.ts`, `build-config.ts`, `runtime-config-adapter.ts`) | Phá "nguồn sự thật" config, rối vị trí file (config-and-environment §3)                                                               |
| Viết code nguồn thuộc Phase 2+ (contracts khác `config-schema.ts`, logic nghiệp vụ)                             | Vượt scope, phá Bottom-Up; `0_contracts/` chưa được duyệt đầy đủ (G0-03)                                                              |
| Dùng `eslint-plugin-react@7.37.5` với ESLint 10                                                                 | Peer range `^9.7` → lint crash/undefined behavior                                                                                     |
| Dùng TypeScript 7.x (`latest` trên npm)                                                                         | `typescript-eslint` peer `<6.1.0` + `dependency-cruiser` `<7.0.0` → toolchain gãy                                                     |
| Chạy `wxt init` trong thư mục đã có `src/`                                                                      | Hard-abort `process.exit(1)` — thư mục không rỗng                                                                                     |
| Bypass hook gate (`--no-verify`, né force_ask, `describe.only`...)                                              | Vi phạm DES-2/Stage-4/Stage-5 — gate deny, hợp đồng data vỡ âm thầm                                                                   |
| Đặt entrypoints ngoài `src/1_engine`                                                                            | Phá quy tắc tầng "1_engine là nơi DUY NHẤT chứa defineBackground/defineContentScript" — nhớ cấu hình đúng `entrypointsDir` (số nhiều) |
| Để `prebuild` chạy trước `wxt prepare` mà không có `.wxt/`                                                      | ESLint/tsconfig import file chưa sinh → crash khó chẩn đoán (R8)                                                                      |

## 10. Quyết định đã chốt (locked 2026-08-05)

| #   | Quyết định                      | Chốt                                                                               |
| --- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Q1  | Package manager                 | ✅ **pnpm** (pin `packageManager: pnpm@10.32.1`)                                   |
| Q2  | TypeScript                      | ✅ **`~6.0.3`**                                                                    |
| Q3  | Commit 3 file `.env.*`          | ✅ **Có** — chỉ config public, không secret                                        |
| Q4  | Shell background tối thiểu (T6) | ✅ **Có** — `src/1_engine/background/index.ts` bootstrap rỗng để `pnpm build` xanh |

## 11. Handoff cho executor (theo §12 Architect-workspace)

> Khi thực thi, giao theo prompt template sau (đủ 6 phần: TASK / EXPECTED OUTCOME / REQUIRED TOOLS / MUST DO / MUST NOT DO / CONTEXT):

```
TASK: Thực thi Docs/Setups/phase-1-setup-plan.md — T0→T10, tuân thủ thứ tự gate.
EXPECTED OUTCOME: Branch setup/phase-1-infra-config có đủ hạ tầng, `pnpm typecheck && pnpm lint && pnpm test && pnpm build` xanh, CFG-2 negative test có bằng chứng.
REQUIRED TOOLS: bash (pnpm/node), write/edit, read. KHÔNG dùng agent khác.
MUST DO: Tạo GO doc TRƯỚC mọi write src/ (G0-04); chờ user duyệt khi G0-03 force_ask; cuối mỗi lượt chạy verify (G0-06); giữ console.log chỉ trong scripts/ hoặc logger.
MUST NOT DO: Không đổi version bảng §5; không viết code Phase 2+; không bypass hook; không tạo file config ngoài danh sách §6.
CONTEXT: Rules đã nạp — .agent/rules/config-and-environment.md, tech-stack-and-conventions.md, code-quality-and-gates.md. Hooks G0-01..G2-04 đang active (xem .agent/hooks.json).
```

---

_Tài liệu cập nhật khi có ADR/quyết định mới; nạp lại cho AI Agent đầu mỗi phiên làm việc._
