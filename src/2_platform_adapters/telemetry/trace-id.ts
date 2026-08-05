/**
 * Correlation ID generation (OBS-2, ADR-003).
 * UUIDv4 chuẩn; fallback manual khi crypto.randomUUID không có sẵn
 * (VD: môi trường runtime cũ / test không mock crypto).
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function randomHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Sinh traceId UUIDv4.
 * - Ưu tiên globalThis.crypto.randomUUID (MV3 SW / browser).
 * - Fallback manual dùng Math.random — chỉ khi crypto không khả dụng.
 */
export function createTraceId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  // Fallback manual — cấu trúc UUIDv4 với bit version 4 + variant 10.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, randomHex);
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/**
 * Kiểm tra chuỗi có đúng định dạng UUIDv4 không.
 */
export function isTraceId(id: string): boolean {
  return UUID_V4_RE.test(id);
}
