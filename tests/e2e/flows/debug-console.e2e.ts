import { expect } from '@playwright/test';
import { extensionTest } from '../fixtures/extension.fixture';

/**
 * Debug Console E2E (T6.3 — OBS-3): mở debug-console/index.html → LogViewer
 * port broadcast real-time → entry xuất hiện đúng traceId. Verify UI Layer 4
 * nhận log qua Port long-lived (port-channel) từ SW thật — chuỗi xuyên process.
 */
extensionTest(
  'debug-console: LogViewer hiển thị log đúng traceId qua port',
  async ({ page, context }) => {
    // Mở Debug Console trước — port được connect từ UI
    const consolePage = await context.newPage();
    await consolePage.goto(await page.evaluate(() => chrome.runtime.getURL('debug-console.html')));

    // Emit log từ page extension khác (client giả lập) → SW → broadcast → Debug Console
    const traceId = `e2e-console-${Date.now()}`;
    await page.evaluate(
      ({ tid, ts }) =>
        chrome.runtime.sendMessage({
          action: 'telemetry.log.sink',
          traceId: tid,
          entry: {
            trace_id: tid,
            scope: 'background',
            level: 'INFO',
            file_line: 'src/1_engine/background/index.ts:1',
            decision_reason: 'log real-time tới Debug Console',
            payload: {},
            timestamp: ts,
          },
        }),
      { tid: traceId, ts: new Date().toISOString() },
    );

    // LogViewer hiển thị entry — traceId xuất hiện trong DOM
    await expect(consolePage.getByText(traceId).first()).toBeVisible({ timeout: 10_000 });
    // Decision reason hiển thị
    await expect(consolePage.getByText('log real-time tới Debug Console').first()).toBeVisible();
    // Export button đếm entries — đã nhận entry qua port
    await expect(consolePage.getByText(/Export log JSON/).first()).toBeVisible();
  },
);

/**
 * Filter theo scope: nhập 'background' → chỉ entry đúng scope còn lại.
 */
extensionTest('debug-console: filter scope hoạt động', async ({ page, context }) => {
  const consolePage = await context.newPage();
  await consolePage.goto(await page.evaluate(() => chrome.runtime.getURL('debug-console.html')));

  const traceIdA = `e2e-filter-a-${Date.now()}`;
  const traceIdB = `e2e-filter-b-${Date.now()}`;
  for (const [tid, scope] of [
    [traceIdA, 'background'],
    [traceIdB, 'bookmark-manager'],
  ] as const) {
    await page.evaluate(
      ({ tid: id, scope: s, ts }) =>
        chrome.runtime.sendMessage({
          action: 'telemetry.log.sink',
          traceId: id,
          entry: {
            trace_id: id,
            scope: s,
            level: 'INFO',
            file_line: 'tests/e2e/flows/debug-console.e2e.ts:1',
            decision_reason: 'filter test',
            payload: {},
            timestamp: ts,
          },
        }),
      { tid, scope, ts: new Date().toISOString() },
    );
  }

  // Cả 2 entry hiện
  await expect(consolePage.getByText(traceIdA).first()).toBeVisible({ timeout: 10_000 });
  await expect(consolePage.getByText(traceIdB).first()).toBeVisible();

  // Nhập scope 'background' → chỉ entry A còn
  await consolePage.getByLabel('Scope').fill('background');
  await expect(consolePage.getByText(traceIdA).first()).toBeVisible();
  await expect(consolePage.getByText(traceIdB).first()).toBeHidden();
});
