import { expect } from '@playwright/test';
import { extensionTest, inspectStorage } from '../fixtures/extension.fixture';

/**
 * IPC SettingsGet/Set roundtrip (T6.2) — xuyên SW thật:
 * popup page → runtime.sendMessage → SW (message-listener → router → runtime-config-adapter)
 * → chrome.storage.local → response ngược. Chứng minh chuỗi IPC Layer 4→2→1 hoạt động.
 */
extensionTest('settings: SettingsGet/Set roundtrip qua storage thật', async ({ page }) => {
  // Set theme = dark qua IPC
  const setResponse = await page.evaluate(
    () =>
      chrome.runtime.sendMessage({
        action: 'settings.set',
        traceId: 'e2e-set-dark',
        key: 'settings.theme',
        value: 'dark',
      }) as Promise<{ ok: boolean }>,
  );
  expect(setResponse.ok).toBe(true);

  // Get lại qua IPC — SW đọc từ chrome.storage.local
  const getResponse = await page.evaluate(
    () =>
      chrome.runtime.sendMessage({
        action: 'settings.get',
        traceId: 'e2e-get-dark',
        key: 'settings.theme',
      }) as Promise<{ ok: boolean; data?: { value: unknown } }>,
  );
  expect(getResponse.ok).toBe(true);
  expect(getResponse.data?.value).toBe('dark');
});

/**
 * StorageInspect local — verify giá trị vừa set nằm đúng area local (storage-schema:
 * 'settings.theme' thuộc StorageLocalSchema).
 */
extensionTest('settings: giá trị set nằm đúng storage local', async ({ page }) => {
  await page.evaluate(() =>
    chrome.runtime.sendMessage({
      action: 'settings.set',
      traceId: 'e2e-set-1',
      key: 'settings.theme',
      value: 'light',
    }),
  );
  const local = await inspectStorage(page, 'local');
  expect(local['settings.theme']).toBe('light');
  // theme KHÔNG nằm session (schema phân tầng rõ ràng)
  const session = await inspectStorage(page, 'session');
  expect(session['settings.theme']).toBeUndefined();
});

/**
 * Sender timeout+retry: action chưa đăng ký → error response (không throw, không crash).
 * Router không có handler → {ok:false} UNKNOWN_ERROR (router.ts NO_HANDLER_ERROR).
 */
extensionTest('ipc: action chưa đăng ký → error response không crash', async ({ page }) => {
  const response = await page.evaluate(
    () =>
      chrome.runtime.sendMessage({
        action: 'bookmark.save',
        traceId: 'e2e-unregistered',
      }) as Promise<{ ok: boolean; error?: { code: string } }>,
  );
  expect(response.ok).toBe(false);
  expect(response.error?.code).toBe('UNKNOWN_ERROR');
});
