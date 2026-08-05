import { describe, expect, it } from 'vitest';
import {
  AppErrorCode,
  type IpcRequestPayload,
  type MessageResponse,
} from '@contracts/ipc-payloads';
import { IpcAction } from '@contracts/ipc-actions';
import { LogLevel, type LogEntry } from '@contracts/log-schema';
import type { LogSinkRequest, SettingsGetRequest } from '@contracts/ipc-payloads';
import { Router } from '../../../src/2_platform_adapters/ipc/router';

const entry: LogEntry = {
  trace_id: 'trace-1',
  scope: 'test',
  level: LogLevel.INFO,
  file_line: 'src/test.ts:1',
  decision_reason: 'x',
  payload: {},
  timestamp: '2026-08-05T00:00:00.000Z',
};

const logSinkRequest: IpcRequestPayload = {
  action: IpcAction.LogSink,
  traceId: 'trace-1',
  entry,
};

const settingsGetRequest: IpcRequestPayload = {
  action: IpcAction.SettingsGet,
  traceId: 'trace-2',
  key: 'settings.telemetry_enabled',
};

describe('Router', () => {
  it('dispatch đúng handler theo action — trả response type-safe', async () => {
    const router = new Router();
    router.registerHandler(IpcAction.LogSink, (req: LogSinkRequest) => {
      expect(req.entry).toBe(entry);
      return { ok: true, data: { acknowledged: true } };
    });
    router.registerHandler(IpcAction.SettingsGet, (req: SettingsGetRequest) => {
      expect(req.key).toBe('settings.telemetry_enabled');
      return { ok: true, data: { value: true } };
    });

    const logResponse = await router.handle(logSinkRequest);
    expect(logResponse).toEqual({ ok: true, data: { acknowledged: true } });

    const settingsResponse = await router.handle(settingsGetRequest);
    expect(settingsResponse).toEqual({ ok: true, data: { value: true } });
  });

  it('action chưa đăng ký → UNKNOWN_ERROR', async () => {
    const router = new Router();
    const response = await router.handle(settingsGetRequest);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(AppErrorCode.UNKNOWN_ERROR);
    }
  });

  it('handler throw → error response, không rethrow ra ngoài', async () => {
    const router = new Router();
    router.registerHandler(IpcAction.LogSink, () => {
      throw new Error('boom');
    });

    const response = await router.handle(logSinkRequest);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(AppErrorCode.UNKNOWN_ERROR);
    }
  });

  it('handler trả response đồng bộ (không async) cũng được', async () => {
    const router = new Router();
    router.registerHandler(IpcAction.SettingsGet, (): MessageResponse<{ value: unknown }> => {
      return { ok: true, data: { value: 'sync' } };
    });

    const response = await router.handle(settingsGetRequest);
    expect(response).toEqual({ ok: true, data: { value: 'sync' } });
  });
});
