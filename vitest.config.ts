import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // polyfill browser (fake-browser) + alias từ wxt.config.ts + auto-imports
  plugins: [WxtVitest()],
  test: {
    coverage: {
      // TST-1 (§11): coverage chỉ tính trên Layer 3 (pure TS) — ngưỡng 90% lines
      include: ['src/3_modules/**'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
      reporter: ['text', 'text-summary'],
    },
  },
});
