import { describe, expect, it } from 'vitest';
import {
  AppErrorCode,
  IpcAction,
  LogLevel,
  type LogEntry,
  type LogSinkRequest,
  type MessageResponse,
  type SettingsGetRequest,
  type SettingsSetRequest,
  type StorageInspectRequest,
} from '../../src/0_contracts';

describe('IPC Payload & Contract Shape Specification (OBS-2)', () => {
  it('should maintain exact 4 infrastructure IpcActions', () => {
    expect(Object.values(IpcAction)).toEqual([
      'telemetry.log.sink',
      'settings.get',
      'settings.set',
      'debug.storage.inspect',
    ]);
  });

  it('should enforce mandatory traceId field on all IPC requests', () => {
    const logReq: LogSinkRequest = {
      action: IpcAction.LogSink,
      traceId: 'trace-123-abc',
      entry: {
        trace_id: 'trace-123-abc',
        scope: 'telemetry',
        level: LogLevel.INFO,
        file_line: 'logger.ts:42',
        decision_reason: 'test entry',
        payload: {},
        timestamp: '2026-08-05T03:00:00.000Z',
      },
    };

    const getReq: SettingsGetRequest = {
      action: IpcAction.SettingsGet,
      traceId: 'trace-456-def',
      key: 'settings.theme',
    };

    const setReq: SettingsSetRequest = {
      action: IpcAction.SettingsSet,
      traceId: 'trace-789-ghi',
      key: 'settings.theme',
      value: 'dark',
    };

    const inspectReq: StorageInspectRequest = {
      action: IpcAction.StorageInspect,
      traceId: 'trace-000-xyz',
      area: 'local',
    };

    expect(logReq.traceId).toBeDefined();
    expect(getReq.traceId).toBeDefined();
    expect(setReq.traceId).toBeDefined();
    expect(inspectReq.traceId).toBeDefined();
  });

  it('should correctly format MessageResponse success branch', () => {
    const successResponse: MessageResponse<{ theme: string }> = {
      ok: true,
      data: { theme: 'dark' },
    };

    expect(successResponse.ok).toBe(true);
    if (successResponse.ok) {
      expect(successResponse.data.theme).toBe('dark');
    }
  });

  it('should correctly format MessageResponse error branch with AppError', () => {
    const errorResponse: MessageResponse<never> = {
      ok: false,
      error: {
        code: AppErrorCode.STORAGE_ERROR,
        message: 'Storage quota exceeded',
        detail: { key: 'telemetry.logs.buffer' },
      },
    };

    expect(errorResponse.ok).toBe(false);
    if (!errorResponse.ok) {
      expect(errorResponse.error.code).toBe(AppErrorCode.STORAGE_ERROR);
      expect(errorResponse.error.message).toBe('Storage quota exceeded');
    }
  });

  it('should satisfy 7-field LogEntry schema requirement', () => {
    const entry: LogEntry = {
      trace_id: 'tr-999',
      scope: 'engine:background',
      level: LogLevel.INFO,
      file_line: 'background/index.ts:15',
      decision_reason: 'Service worker initialized',
      payload: { version: '1.0.0' },
      timestamp: '2026-08-05T03:00:00.000Z',
    };

    expect(entry.trace_id).toBe('tr-999');
    expect(entry.scope).toBe('engine:background');
    expect(entry.level).toBe(LogLevel.INFO);
    expect(entry.file_line).toBe('background/index.ts:15');
    expect(entry.decision_reason).toBe('Service worker initialized');
    expect(entry.payload).toEqual({ version: '1.0.0' });
    expect(entry.timestamp).toBe('2026-08-05T03:00:00.000Z');
  });
});
