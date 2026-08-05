import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E (testing-and-verification.md §2, §3) — load extension build THẬT.
 * testDir giới hạn tests/e2e — Playwright KHÔNG được nuốt spec Vitest
 * (tests/unit, tests/contract). Build extension trước (pnpm build → .output/chrome-mv3).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // Mặc định Playwright chỉ nhận *.spec.ts/*.test.ts — dự án đặt tên *.e2e.ts
  // (testing-and-verification.md §3) → khai báo testMatch tường minh.
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: true,
  retries: 2, // MV3 SW wake-up flake — retry chứ không skip (G0-05: cấm test.skip)
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
