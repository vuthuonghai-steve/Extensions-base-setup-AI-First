import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // polyfill browser (fake-browser) + alias từ wxt.config.ts + auto-imports
  plugins: [WxtVitest()],
});
