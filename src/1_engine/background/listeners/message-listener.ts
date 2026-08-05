import { browser, type Browser } from 'wxt/browser';
import type { IpcRequestPayload, MessageResponse } from '@contracts/ipc-payloads';
import { createLogger } from '@platform/telemetry/logger';
import type { Router } from '@platform/ipc/router';

const logger = createLogger('background');

/**
 * Message listener (Architect §3, §5) — CHỈ route, không xử lý nghiệp vụ:
 * onMessage → extract request → router.handle → trả qua sendResponse
 * (runtime.onMessage type là sync callback — promise phải tái dùng sendResponse).
 */
export function registerMessageListener(router: Router): void {
  const listener = (
    message: unknown,
    _sender: Browser.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | undefined => {
    if (!isIpcRequest(message)) {
      logger.warn('Non-IPC message received — ignored', {});
      return undefined;
    }
    // KHÔNG log routing ở đây — logger transport gửi LogSink qua runtime.sendMessage
    // → listener này nhận lại → recursion vô hạn khi threshold DEBUG.
    void router.handle(message).then(
      (response: MessageResponse<unknown>) => sendResponse(response),
      (error: unknown) => {
        logger.error('Router handle rejected', { error: String(error) });
        sendResponse({
          ok: false,
          error: { code: 'UNKNOWN_ERROR', message: 'Router handle rejected' },
        });
      },
    );
    // MV3: trả true = giữ channel mở cho sendResponse async (SW handler route).
    return true;
  };
  browser.runtime.onMessage.addListener(listener);
}

/** Structural guard nhanh — IpcRequestPayload là discriminated union (0_contracts). */
function isIpcRequest(value: unknown): value is IpcRequestPayload {
  if (typeof value !== 'object' || value === null) return false;
  const req = value as Record<string, unknown>;
  return typeof req.action === 'string' && typeof req.traceId === 'string';
}
