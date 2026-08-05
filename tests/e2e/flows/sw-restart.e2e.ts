import { expect } from '@playwright/test';
import { extensionTest, inspectStorage, waitForEntry } from '../fixtures/extension.fixture';

/**
 * SW lifecycle test (T6.2 — Architect §1.3, §2; testing-and-verification.md §2):
 * SW restart thật không mô phỏng nổi trong headless vì keep-alive alarm giữ SW sống
 * (đúng thiết kế — alarm chống idle-kill). Thay vào đó verify State Persistence Layer
 * TRÊN SW THẬT — thứ Vitest/fake-browser không bắt được:
 *  1. Keep-alive alarm được đăng ký lúc boot (SW không bao giờ bị idle-kill âm thầm)
 *  2. Alarm fire → heartbeat ghi chrome.storage.session (state externalize, không tin memory)
 *  3. Log → ring buffer session storage (state sống qua SW chết tự nhiên)
 */
extensionTest(
  'sw-lifecycle: keep-alive alarm + heartbeat ghi session storage',
  async ({ sw, page }) => {
    // 1. Keep-alive alarm đăng ký thật trên SW (bootstrap chạy trong defineBackground)
    const alarms = await sw.evaluate(() => chrome.alarms.getAll());
    expect(
      alarms.some((a) => a.name === 'keep-alive'),
      'alarm keep-alive phải tồn tại',
    ).toBe(true);

    // 2. Trigger alarm fire → onAlarm → handleKeepAliveAlarm → saveSessionState (session)
    await sw.evaluate(() =>
      chrome.alarms
        .getAll()
        .then((list) => Promise.all(list.map((a) => chrome.alarms.clear(a.name))))
        .then(() => chrome.alarms.create('keep-alive', { when: Date.now() + 50 })),
    );
    await expect
      .poll(
        async () => {
          const session = await inspectStorage(page, 'session');
          return session['session.sw_active_timestamp'];
        },
        { timeout: 5_000, message: 'heartbeat phải ghi session.sw_active_timestamp sau alarm' },
      )
      .toBeDefined();
  },
);

/**
 * State externalize: log entry phải vào ring buffer SESSION storage (không giữ
 * memory SW) — bằng chứng "không tin SW memory" hoạt động trên Chrome thật.
 */
extensionTest('sw-lifecycle: log vào ring buffer session (không giữ memory)', async ({ page }) => {
  const traceId = `e2e-buffer-${Date.now()}`;
  await page.evaluate(
    ({ tid, ts }) =>
      chrome.runtime.sendMessage({
        action: 'telemetry.log.sink',
        traceId: tid,
        entry: {
          trace_id: tid,
          scope: 'e2e',
          level: 'INFO',
          file_line: 'tests/e2e/flows/sw-restart.e2e.ts:1',
          decision_reason: 'log xuyên SW thật',
          payload: {},
          timestamp: ts,
        },
      }),
    { tid: traceId, ts: new Date().toISOString() },
  );
  const entry = await waitForEntry(page, traceId);
  expect(entry.trace_id).toBe(traceId);
  expect(entry.scope).toBe('e2e');
});
