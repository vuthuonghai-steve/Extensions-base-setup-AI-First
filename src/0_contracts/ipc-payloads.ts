import type { IpcAction } from './ipc-actions';
import type { LogEntry } from './log-schema';
import type { StorageArea, StorageKey } from './storage-schema';

/**
 * Standard Error Codes for AppError discriminated union.
 */
export enum AppErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  STORAGE_ERROR = 'STORAGE_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * Structured application error contract across process boundaries.
 */
export interface AppError {
  code: AppErrorCode;
  message: string;
  detail?: unknown;
}

/**
 * Generic response envelope for all IPC communication.
 */
export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: AppError };

/**
 * Base IPC Request Contract.
 * Every request MUST contain a non-optional traceId for observability tracing (OBS-2).
 */
export interface BaseIpcRequest {
  action: IpcAction;
  traceId: string;
}

export interface LogSinkRequest extends BaseIpcRequest {
  action: IpcAction.LogSink;
  entry: LogEntry;
}

export interface SettingsGetRequest extends BaseIpcRequest {
  action: IpcAction.SettingsGet;
  key?: StorageKey;
}

export interface SettingsSetRequest extends BaseIpcRequest {
  action: IpcAction.SettingsSet;
  key: StorageKey;
  value: unknown;
}

export interface StorageInspectRequest extends BaseIpcRequest {
  action: IpcAction.StorageInspect;
  area?: StorageArea;
}

/**
 * Discriminated union of all IPC Request Payloads.
 */
export type IpcRequestPayload =
  LogSinkRequest | SettingsGetRequest | SettingsSetRequest | StorageInspectRequest;

export type LogSinkResponseData = { acknowledged: boolean };
export type SettingsGetResponseData = { value: unknown };
export type SettingsSetResponseData = void;
export type StorageInspectResponseData = { data: Record<string, unknown> };

/**
 * Type-level mapping between IpcAction and its expected MessageResponse payload.
 * Nguồn sự thật cho Phase 3 router; shape được khóa bởi compile-time assert trong
 * tests/contract/ipc-payload-shape.spec.ts.
 */
export type IpcResponseMap = {
  [IpcAction.LogSink]: MessageResponse<LogSinkResponseData>;
  [IpcAction.SettingsGet]: MessageResponse<SettingsGetResponseData>;
  [IpcAction.SettingsSet]: MessageResponse<SettingsSetResponseData>;
  [IpcAction.StorageInspect]: MessageResponse<StorageInspectResponseData>;
};
