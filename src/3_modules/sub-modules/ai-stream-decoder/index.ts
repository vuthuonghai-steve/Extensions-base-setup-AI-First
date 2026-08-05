/**
 * Sub-module thuần: decode SSE stream (Architect §4 — Layer 3 Pure TS).
 * Nhận chuỗi text (nhiều line `data:` có thể ghép trong 1 chunk), trả về
 * chunks JSON đã parse; `[DONE]` kết thúc; malformed line bị skip (đếm số lỗi).
 */

export interface StreamDecodeResult {
  chunks: unknown[];
  done: boolean;
  skipped: number;
}

export const DONE_SENTINEL = '[DONE]';

/** Tách `data:` lines và decode từng chunk từ một đoạn SSE text. */
export function decodeSseChunk(raw: string): StreamDecodeResult {
  const chunks: unknown[] = [];
  let done = false;
  let skipped = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (data === '') continue;
    if (data === DONE_SENTINEL) {
      done = true;
      continue;
    }
    try {
      chunks.push(JSON.parse(data));
    } catch {
      skipped += 1;
    }
  }
  return { chunks, done, skipped };
}
