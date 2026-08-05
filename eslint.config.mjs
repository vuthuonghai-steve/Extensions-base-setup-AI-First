import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier/flat';
import autoImports from './.wxt/eslint-auto-imports.mjs'; // wxt prepare sinh — cần chạy trước

export default [
  {
    ignores: [
      '.wxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'Docs/**', // tài liệu OMC/skills — ngoài phạm vi lint product
      '.agent/**',
      '.claude/**',
      'scripts/validate-env.ts', // Node script đứng riêng — không thuộc src/ product
    ],
  },
  autoImports,
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'], // type-checked rules chỉ áp dụng cho TS — tránh crash trên .mjs/.js config
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  })),
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
    // Playwright fixtures dùng `use` (test.extend) — không phải React hook
    files: ['tests/e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
      // Fixture context async ({}, use) — Playwright require destructuring, không bỏ được
      'no-empty-pattern': 'off',
    },
  },
  {
    // OBS-1: cấm console trần trong src/ (mọi level)
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
  {
    // ...trừ telemetry/logger.ts
    files: ['**/telemetry/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // File config ngoài src/ — định nghĩa globals Node/CommonJS
    files: ['*.{js,mjs,cjs}', 'wxt.config.ts'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  prettier, // LUÔN cuối cùng
];
