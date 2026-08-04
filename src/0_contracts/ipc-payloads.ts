import type { IpcAction } from './ipc-actions';
import type { LogEntry } from './log-schema';

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
  traceId: string;
  entry: LogEntry;
}

export interface SettingsGetRequest extends BaseIpcRequest {
  action: IpcAction.SettingsGet;
  traceId: string;
  key?: string;
}

export interface SettingsSetRequest extends BaseIpcRequest {
  action: IpcAction.SettingsSet;
  traceId: string;
  key: string;
  value: unknown;
}

export interface StorageInspectRequest extends BaseIpcRequest {
  action: IpcAction.StorageInspect;
  traceId: string;
  area?: 'local' | 'session' | 'sync';
}

/**
 * Discriminated union of all IPC Request Payloads.
 */
export type IpcRequestPayload =
  LogSinkRequest | SettingsGetRequest | SettingsSetRequest | StorageInspectRequest;

export type LogSinkResponseData = { acknowledged: boolean };
export type SettingsGetResponseData = { value: unknown };
export type SettingsSetResponseData = { success: boolean };
export type StorageInspectResponseData = { data: Record<string, unknown> };

/**
 * Type-level mapping between IpcAction and its expected MessageResponse payload.
 */
export type IpcResponseMap = {
  [IpcAction.LogSink]: MessageResponse<LogSinkResponseData>;
  [IpcAction.SettingsGet]: MessageResponse<SettingsGetResponseData>;
  [IpcAction.SettingsSet]: MessageResponse<SettingsSetResponseData>;
  [IpcAction.StorageInspect]: MessageResponse<StorageInspectResponseData>;
};
