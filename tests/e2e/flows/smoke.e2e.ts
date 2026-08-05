import { expect } from '@playwright/test';
import { extensionTest, inspectStorage } from '../fixtures/extension.fixture';

/**
 * Smoke test (T6.1) — verify extension load THẬT trong Chrome:
 * SW background.js tồn tại + IPC StorageInspect roundtrip thành công.
 * Nếu fail ở đây: extension không load được (flag sai / build thiếu).
 */
extensionTest('extension load: SW tồn tại + IPC StorageInspect roundtrip', async ({ sw, page }) => {
  // SW handle sống — background.js URL đúng
  expect(sw.url()).toMatch(/background\.js$/);
  // IPC roundtrip qua extension page → SW thật → storage
  const data = await inspectStorage(page, 'session');
  expect(typeof data).toBe('object');
});
