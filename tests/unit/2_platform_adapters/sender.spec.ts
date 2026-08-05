import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { IpcAction } from '@contracts/ipc-actions';
import { AppErrorCode } from '@contracts/ipc-payloads';
import { LogLevel } from '@contracts/log-schema';
import { sendMessage } from '@platform/ipc/sender';

type Listener = (message: unknown) => unknown;

describe('sendMessage', () => {
  let calls: unknown[];
  let listener: Listener | undefined;

  beforeEach(() => {
    calls = [];
    fakeBrowser.runtime.onMessage.addListener(
      (message: unknown, _sender: unknown, sendResponse: (res: unknown) => void) => {
        calls.push(message);
        const result = listener ? listener(message) : undefined;
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          // async listener: await rồi mới sendResponse (fake giữ channel mở khi trả true)
          (result as Promise<unknown>).then(sendResponse, () => sendResponse(undefined));
        } else if (result !== undefined) {
          sendResponse(result);
        }
        return true; // fake-browser: trả true mới resolve response
      },
    );
  });

  afterEach(() => {
    fakeBrowser.runtime.onMessage.removeAllListeners();
  });

  it('success path trả data', async () => {
    listener = () => ({ ok: true, data: { value: 'dark' } });
    const result = await sendMessage(IpcAction.SettingsGet, {});
    expect(result).toEqual({ ok: true, data: { value: 'dark' } });
    expect(calls).toHaveLength(1);
    const sent = calls[0] as { action: string; traceId: string };
    expect(sent.action).toBe(IpcAction.SettingsGet);
    expect(sent.traceId).toBeDefined();
    expect(sent.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('read-only action (SettingsGet): fail lần đầu → retry 1 lần → success', async () => {
    let attempts = 0;
    listener = () => {
      attempts += 1;
      if (attempts === 1)
        throw new Error('Could not establish connection. Receiving end does not exist.');
      return { ok: true, data: { value: 'dark' } };
    };
    const result = await sendMessage(IpcAction.SettingsGet, {});
    expect(result).toEqual({ ok: true, data: { value: 'dark' } });
    expect(calls).toHaveLength(2);
  });

  it('side-effect action (LogSink): fail lần đầu → KHÔNG retry', async () => {
    listener = () => {
      throw new Error('Could not establish connection. Receiving end does not exist.');
    };
    const result = await sendMessage(IpcAction.LogSink, {
      entry: {
        trace_id: 'tr-1',
        scope: 'test',
        level: LogLevel.INFO,
        file_line: 'sender.spec.ts:1',
        decision_reason: 'test',
        payload: {},
        timestamp: '2026-08-05T03:00:00.000Z',
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AppErrorCode.NETWORK_TIMEOUT);
    }
    expect(calls).toHaveLength(1);
  });

  it('opts.retries override: LogSink retry 2 lần khi được chỉ định', async () => {
    let attempts = 0;
    listener = () => {
      attempts += 1;
      if (attempts < 3) throw new Error('not ready');
      return { ok: true, data: { acknowledged: true } };
    };
    const result = await sendMessage(
      IpcAction.LogSink,
      {
        entry: {
          trace_id: 'tr-1',
          scope: 'test',
          level: LogLevel.INFO,
          file_line: 'sender.spec.ts:1',
          decision_reason: 'test',
          payload: {},
          timestamp: '2026-08-05T03:00:00.000Z',
        },
      },
      { retries: 2 },
    );
    expect(result).toEqual({ ok: true, data: { acknowledged: true } });
    expect(calls).toHaveLength(3);
  });

  it('lỗi khác throw từ listener → MessageResponse error (không throw)', async () => {
    listener = () => {
      throw new Error('boom');
    };
    const result = await sendMessage(IpcAction.SettingsSet, {
      key: 'settings.theme',
      value: 'dark',
    });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('timeout → NETWORK_TIMEOUT error (read-only retry xong vẫn fail)', async () => {
    vi.useFakeTimers();
    try {
      listener = () => new Promise<never>(() => {});
      const pending = sendMessage(IpcAction.SettingsGet, {});
      await vi.advanceTimersByTimeAsync(3000); // attempt 1 timeout
      await vi.advanceTimersByTimeAsync(150); // delay giữa retry
      await vi.advanceTimersByTimeAsync(3000); // attempt 2 timeout
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(AppErrorCode.NETWORK_TIMEOUT);
      }
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('auto-inject traceId nếu opts.traceId bỏ qua', async () => {
    listener = () => ({ ok: true, data: { value: 'dark' } });
    await sendMessage(IpcAction.SettingsGet, {});
    const auto = (calls[0] as { traceId: string }).traceId;
    expect(auto).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('giữ nguyên traceId truyền qua opts', async () => {
    listener = () => ({ ok: true, data: { value: 'dark' } });
    const custom = '8f3a1b2c-9012-4e5f-b678-123456789abc';
    await sendMessage(IpcAction.SettingsGet, {}, { traceId: custom });
    expect((calls[0] as { traceId: string }).traceId).toBe(custom);
  });
});
