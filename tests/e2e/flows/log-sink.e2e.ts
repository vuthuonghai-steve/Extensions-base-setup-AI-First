import { expect } from '@playwright/test';
import { extensionTest, inspectStorage, waitForEntry } from '../fixtures/extension.fixture';

/**
 * LogSink pipeline E2E (T6.3 — OBS-3): emit log qua IPC → SW validate + sanitize
 * → ring buffer session → StorageInspect đọc lại đúng traceId. Xuyên toàn bộ
 * chuỗi Layer 2 telemetry trên Chrome thật (Vitest đã cover unit — đây là SW thật).
 */
extensionTest('log-sink: entry xuất hiện trong ring buffer đúng traceId', async ({ page }) => {
  const traceId = `e2e-sink-${Date.now()}`;
  await page.evaluate(
    ({ tid, ts }) =>
      chrome.runtime.sendMessage({
        action: 'telemetry.log.sink',
        traceId: tid,
        entry: {
          trace_id: tid,
          scope: 'bookmark-manager',
          level: 'WARN',
          file_line:
            'src/3_modules/composite-modules/bookmark-manager/use-cases/bookmark-actions.ts:42',
          decision_reason: 'URL không hợp lệ khi lưu bookmark',
          payload: { error_code: 'INVALID_URL' },
          timestamp: ts,
        },
      }),
    { tid: traceId, ts: new Date().toISOString() },
  );

  const entry = await waitForEntry(page, traceId);
  expect(entry.trace_id).toBe(traceId);
  expect(entry.scope).toBe('bookmark-manager');
  expect(entry.level).toBe('WARN');
  expect(entry.payload).toEqual({ error_code: 'INVALID_URL' });
});

/**
 * Sanitize PII chạy THẬT trên SW: payload chứa chuỗi secret-like (sk-) phải
 * bị log-sink redact thành [REDACTED] trước khi vào storage (logging rule §4).
 */
extensionTest('log-sink: payload chứa secret-like bị sanitize [REDACTED]', async ({ page }) => {
  const traceId = `e2e-secret-${Date.now()}`;
  await page.evaluate(
    ({ tid, ts }) =>
      chrome.runtime.sendMessage({
        action: 'telemetry.log.sink',
        traceId: tid,
        entry: {
          trace_id: tid,
          scope: 'auth',
          level: 'ERROR',
          file_line: 'src/2_platform_adapters/telemetry/log-sink.ts:1',
          decision_reason: 'auth fail',
          payload: { api_key: 'sk-test-123456', user: 'alice' },
          timestamp: ts,
        },
      }),
    { tid: traceId, ts: new Date().toISOString() },
  );

  const entry = await waitForEntry(page, traceId);
  // Key 'api_key' khớp SECRET_KEY_PATTERN → '[REDACTED]'; 'user' giữ nguyên
  expect(entry.payload['api_key']).toBe('[REDACTED]');
  expect(entry.payload['user']).toBe('alice');
});

/**
 * Entry không hợp lệ (thiếu field) → LogSink reject {ok:false} — không crash SW,
 * không ghi vào buffer (log-sink.ts validate isLogEntry).
 */
extensionTest('log-sink: entry thiếu field → reject không crash', async ({ page }) => {
  const response = await page.evaluate(
    () =>
      chrome.runtime.sendMessage({
        action: 'telemetry.log.sink',
        traceId: 'e2e-invalid',
        entry: { trace_id: 'x', scope: 'bad' }, // thiếu level/file_line/decision_reason/timestamp/payload
      }) as Promise<{ ok: boolean }>,
  );
  expect(response.ok).toBe(false);

  // Buffer không chứa entry lỗi
  const session = await inspectStorage(page, 'session');
  const buffer = (session['telemetry.logs.buffer'] ?? []) as Array<{ trace_id: string }>;
  expect(buffer.some((e) => e.trace_id === 'x')).toBe(false);
});
