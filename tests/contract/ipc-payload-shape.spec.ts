import { describe, expect, it } from 'vitest';
import {
  AppErrorCode,
  IpcAction,
  LogLevel,
  type IpcResponseMap,
  type LogEntry,
  type LogSinkRequest,
  type MessageResponse,
  type SettingsGetRequest,
  type SettingsSetRequest,
  type StorageInspectRequest,
} from '../../src/0_contracts';

/**
 * Type-level lock OBS-2 (compile-time — chạy qua `tsc` trong BASE-0).
 * Nếu `traceId` bị đổi thành optional hoặc xóa khỏi bất kỳ request nào,
 * `_AssertTrue` nhận `false` → typecheck đỏ. Không dùng ts-ignore-style
 * comment vì G1-06 chặn pattern đó (ts_ignore, áp dụng cả tests/).
 */
/**
 * Type-level lock OBS-2 (compile-time — chạy qua `tsc` trong BASE-0).
 * Nếu `traceId` bị đổi thành optional hoặc xóa khỏi bất kỳ request nào,
 * `_RequireTraceId` nhận `false` → `_AssertTrue` fail → typecheck đỏ.
 * Không dùng ts-ignore-style comment vì G1-06 chặn pattern đó.
 */
type _RequireTraceId<T> = T extends { traceId: string } ? true : false;
type _AssertTrue<T extends true> = T;

/** Mọi IpcAction phải có entry trong IpcResponseMap (định tuyến Phase 3). */
type _ResponseMapCoversAll = _AssertTrue<IpcAction extends keyof IpcResponseMap ? true : false>;

type _OBS2LogSink = _AssertTrue<_RequireTraceId<LogSinkRequest>>;
type _OBS2SettingsGet = _AssertTrue<_RequireTraceId<SettingsGetRequest>>;
type _OBS2SettingsSet = _AssertTrue<_RequireTraceId<SettingsSetRequest>>;
type _OBS2StorageInspect = _AssertTrue<_RequireTraceId<StorageInspectRequest>>;

// Giữ type alias "được dùng" qua reference ngầm — tránh no-unused-vars.
type _AllLocks = [
  _OBS2LogSink,
  _OBS2SettingsGet,
  _OBS2SettingsSet,
  _OBS2StorageInspect,
  _ResponseMapCoversAll,
];
void (null as unknown as _AllLocks);

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
