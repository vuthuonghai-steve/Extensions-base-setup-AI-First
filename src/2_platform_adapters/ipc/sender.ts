import { browser } from 'wxt/browser';
import { IpcAction } from '@contracts/ipc-actions';
import {
  AppErrorCode,
  type IpcRequestPayload,
  type IpcResponseMap,
  type MessageResponse,
} from '@contracts/ipc-payloads';
import { createTraceId } from '@platform/telemetry/trace-id';

/**
 * Phân loại action theo side-effect (D6) — quyết định retry mặc định:
 * - READ_ONLY (SettingsGet, StorageInspect): SW có thể đang "ngủ" →
 *   mặc định retry 1 lần sau 150ms (message đầu dễ mất).
 * - SIDE_EFFECT (LogSink, SettingsSet): retry có thể ghi trùng →
 *   mặc định 0 retry.
 */
const READ_ONLY_ACTIONS = new Set<IpcAction>([IpcAction.SettingsGet, IpcAction.StorageInspect]);

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRY_DELAY_MS = 150;

export interface SendMessageOptions {
  /** Timeout mỗi lần attempt (ms). Mặc định 3000. */
  timeoutMs?: number;
  /** Số lần retry thêm sau lần đầu fail. Mặc định theo D6: read-only 1, side-effect 0. */
  retries?: number;
  /** Ghi đè traceId — auto-sinh nếu bỏ qua (OBS-2). */
  traceId?: string;
}

type ActionData<T extends IpcAction> = Omit<
  Extract<IpcRequestPayload, { action: T }>,
  'action' | 'traceId'
>;
type ResponseData<T extends IpcAction> =
  IpcResponseMap[T] extends MessageResponse<infer D> ? D : never;

function defaultRetries(action: IpcAction): number {
  return READ_ONLY_ACTIONS.has(action) ? 1 : 0;
}

/**
 * Send IPC message tới Background (SW có thể "ngủ" → timeout + retry,
 * không fail âm thầm — Architect §4). Không bao giờ throw: mọi lỗi
 * (timeout, SW not ready, listener reject) → MessageResponse error.
 */
export async function sendMessage<T extends IpcAction>(
  action: T,
  payload: ActionData<T>,
  opts: SendMessageOptions = {},
): Promise<MessageResponse<ResponseData<T>>> {
  const traceId = opts.traceId ?? createTraceId();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts.retries ?? defaultRetries(action);
  const message = { action, traceId, ...payload } as IpcRequestPayload;

  let lastError: { code: AppErrorCode; message: string } = {
    code: AppErrorCode.NETWORK_TIMEOUT,
    message: 'No response from background (SW not ready)',
  };
  const attempts = maxRetries + 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await delay(DEFAULT_RETRY_DELAY_MS);
    }
    const result = await withTimeout(browser.runtime.sendMessage(message), timeoutMs);
    if (result.ok) {
      if (result.value === undefined) {
        // SW không phản hồi — treat as timeout error để retry
        lastError = {
          code: AppErrorCode.NETWORK_TIMEOUT,
          message: 'No response from background (SW not ready)',
        };
        continue;
      }
      return result.value;
    }
    lastError = result.error;
  }

  return { ok: false, error: { ...lastError, detail: { action, traceId } } };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Promise.race với timeout — reject → lỗi NETWORK_TIMEOUT (không throw).
 */
type AttemptResult<T> =
  | { ok: true; value: T | undefined }
  | { ok: false; error: { code: AppErrorCode; message: string } };

async function withTimeout<T>(
  promise: Promise<T | undefined>,
  timeoutMs: number,
): Promise<AttemptResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('IPC timeout')), timeoutMs);
      }),
    ]);
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { code: AppErrorCode.NETWORK_TIMEOUT, message } };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
