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
  imports: { eslintrc: { enabled: 9 } }, // fix defu-merge: true bị coi là <=8 → sinh JSON; 9 giữ nguyên → ESM
  manifest: () => {
    // D7 — function-form để đọc env sau khi .env load
    const env = import.meta.env as Record<string, string | undefined>;
    return {
      name: env.WXT_APP_NAME ?? '',
      description: env.WXT_APP_DESCRIPTION ?? '',
      version: '0.1.0',
      permissions: ['storage', 'alarms', 'sidePanel'], // Phase 3 storage + Phase 5 D11: keep-alive alarm + side_panel; tối thiểu theo feature thật
      side_panel: {
        default_path: 'sidepanel/index.html',
      },
      options_ui: {
        page: 'options/index.html',
        open_in_tab: true,
      },
    };
  },
});
