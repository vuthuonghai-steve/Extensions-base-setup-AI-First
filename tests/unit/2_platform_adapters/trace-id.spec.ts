import { describe, expect, it } from 'vitest';
import { createTraceId, isTraceId } from '@platform/telemetry/trace-id';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('createTraceId', () => {
  it('trả về UUIDv4 hợp lệ', () => {
    const id = createTraceId();
    expect(id).toMatch(UUID_V4_RE);
  });

  it('khác nhau giữa các lần gọi', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createTraceId()));
    expect(ids.size).toBe(1000);
  });

  it('fallback manual khi crypto.randomUUID không có (vẫn ra UUIDv4)', () => {
    const hasCrypto = 'crypto' in globalThis;
    const cryptoObject = globalThis.crypto;
    const uuidBackup = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      const id = createTraceId();
      expect(id).toMatch(UUID_V4_RE);
    } finally {
      if (hasCrypto) {
        Object.defineProperty(globalThis, 'crypto', { value: cryptoObject, configurable: true });
        if (uuidBackup) {
          Object.defineProperty(cryptoObject, 'randomUUID', {
            value: uuidBackup,
            configurable: true,
          });
        }
      } else {
        delete (globalThis as { crypto?: unknown }).crypto;
      }
    }
  });
});

describe('isTraceId', () => {
  it('true với UUIDv4 hợp lệ', () => {
    expect(isTraceId('8f3a1b2c-9012-4e5f-b678-123456789abc')).toBe(true);
    expect(isTraceId(createTraceId())).toBe(true);
  });

  it('false với định dạng sai', () => {
    expect(isTraceId('')).toBe(false);
    expect(isTraceId('abc')).toBe(false);
    expect(isTraceId('8f3a1b2c-9012-3e5f-b678-123456789abc')).toBe(false); // version sai
    expect(isTraceId('8f3a1b2c-9012-4e5f-c678-123456789abc')).toBe(false); // variant sai
    expect(isTraceId('8f3a1b2c90124e5fb678123456789abc')).toBe(false); // thiếu dash
    expect(isTraceId('GGGGGGGG-9012-4e5f-b678-123456789abc')).toBe(false); // không hex
  });
});
