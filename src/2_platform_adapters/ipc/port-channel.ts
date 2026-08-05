import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';

export interface PortChannel {
  /** Port long-lived — bọc browser.runtime.connect({ name }). */
  port: Browser.runtime.Port;
  /** Gửi dữ liệu JSON-serializable; guard port đã đóng (lỗi postMessage). */
  send(data: unknown): void;
  /** Đóng port an toàn (idempotent). */
  close(): void;
}

/**
 * Mở long-lived connection tới Background (port-channel.ts — Architect §4,
 * streaming log real-time cho Debug Console ADR-003).
 */
export function openPort(name: string): PortChannel {
  const port = browser.runtime.connect({ name });
  let closed = false;
  port.onDisconnect.addListener(() => {
    closed = true;
  });
  return {
    port,
    send(data: unknown): void {
      if (closed) return;
      try {
        port.postMessage(data);
      } catch (error) {
        // Port đã đóng từ phía kia — đánh dấu dead, không throw ra caller.
        closed = true;
        void error;
      }
    },
    close(): void {
      if (closed) return;
      closed = true;
      try {
        port.disconnect();
      } catch (error) {
        void error;
      }
    },
  };
}

/**
 * Subscribe sự kiện onConnect, filter theo port.name — trả unsubscribe.
 */
export function onPortConnect(
  name: string,
  handler: (port: Browser.runtime.Port) => void,
): () => void {
  const listener = (port: Browser.runtime.Port): void => {
    if (port.name === name) handler(port);
  };
  browser.runtime.onConnect.addListener(listener);
  return () => browser.runtime.onConnect.removeListener(listener);
}
