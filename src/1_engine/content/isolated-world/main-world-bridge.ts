import { browser } from 'wxt/browser';

/**
 * Main World bridge (Architect §4, ADR-001) — kênh DUY NHẤT liên lạc
 * Isolated World ↔ Main World (file ngoại lệ G1-06 bridge_file).
 * Main World không có chrome.* → mọi thông tin phải postMessage qua đây.
 */

/** Request từ Main World → Isolated World (action = tên capability). */
export interface MainWorldRequest {
  action: string;
  payload?: unknown;
  requestId: string;
}

/** Response Isolated World → Main World — khớp MessageResponse tinh thần. */
export type MainWorldResponse<T = never> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** Handler cho một action — Isolated World đăng ký. */
export type MainWorldHandler = (payload: unknown) => unknown;

/** Gửi message từ Isolated World xuống Main World. */
export function sendToMainWorld(action: string, payload?: unknown): void {
  void browser.runtime.sendMessage({ action, payload });
}

/** Gửi message từ Main World lên Isolated World — không có chrome.*, phải qua window. */
export function sendToIsolatedWorld(message: MainWorldRequest): void {
  window.postMessage(message, window.location.origin);
}

/** Subscribe request từ Main World (Isolated World dùng). */
export function onMainWorldRequest(handler: MainWorldHandler): () => void {
  const listener = (event: MessageEvent): void => {
    const data = event.data as MainWorldRequest | undefined;
    if (data !== undefined && typeof data === 'object' && typeof data.action === 'string') {
      void handler(data.payload);
    }
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
