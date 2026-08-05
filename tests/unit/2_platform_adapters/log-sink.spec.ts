import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@contracts/log-schema';
import { LogLevel } from '@contracts/log-schema';
import { AppErrorCode } from '@contracts/ipc-payloads';
import { handleLogSinkEntry, isLogEntry, sanitizePayload } from '@platform/telemetry/log-sink';
import type { StorageValue } from '@platform/storage/storage-driver';
import type { StorageKey } from '@contracts/storage-schema';
import type { Result } from '@platform/telemetry/log-ring-buffer';
import { LogRingBuffer, BUFFER_KEY, HEAD_KEY } from '@platform/telemetry/log-ring-buffer';

function validEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    trace_id: 'trace-1',
    scope: 'test',
    level: LogLevel.INFO,
    file_line: 'tests/unit/2_platform_adapters/log-sink.spec.ts:1',
    decision_reason: 'test entry',
    payload: { key: 'value' },
    timestamp: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

class FakeDriver {
  private store = new Map<string, unknown>();

  get<T>(key: string): Promise<Result<T>> {
    return Promise.resolve({ ok: true, data: this.store.get(key) as T });
  }

  getMany<K extends StorageKey>(
    keys: K[],
  ): Promise<Result<Record<K, StorageValue<K> | undefined>>> {
    const out = {} as Record<K, StorageValue<K> | undefined>;
    for (const key of keys) {
      out[key] = this.store.get(key) as StorageValue<K> | undefined;
    }
    return Promise.resolve({ ok: true, data: out });
  }

  subscribe(): () => void {
    return () => undefined;
  }

  remove(): Promise<Result<void>> {
    return Promise.resolve({ ok: true, data: undefined });
  }

  set(values: Record<string, unknown>): Promise<Result<void>> {
    for (const [key, value] of Object.entries(values)) {
      this.store.set(key, value);
    }
    return Promise.resolve({ ok: true, data: undefined });
  }

  getBytesInUse(): Promise<Result<number>> {
    return Promise.resolve({ ok: true, data: 0 });
  }
}

describe('isLogEntry — structural guard', () => {
  it('accepts valid entry', () => {
    expect(isLogEntry(validEntry())).toBe(true);
  });

  it('rejects non-object / null', () => {
    expect(isLogEntry(null)).toBe(false);
    expect(isLogEntry('string')).toBe(false);
    expect(isLogEntry(42)).toBe(false);
    expect(isLogEntry(undefined)).toBe(false);
  });

  it('rejects missing fields', () => {
    const { trace_id: _traceId, ...noTrace } = validEntry();
    void _traceId;
    expect(isLogEntry(noTrace)).toBe(false);
    const { payload: _payload, ...noPayload } = validEntry();
    void _payload;
    expect(isLogEntry(noPayload)).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(isLogEntry(validEntry({ trace_id: 123 as unknown as string }))).toBe(false);
    expect(isLogEntry(validEntry({ level: 'VERBOSE' as LogLevel }))).toBe(false);
    expect(isLogEntry(validEntry({ level: 5 } as unknown as LogEntry))).toBe(false);
    expect(isLogEntry(validEntry({ payload: [] as unknown as Record<string, unknown> }))).toBe(
      false,
    );
    expect(
      isLogEntry(validEntry({ payload: 'string' as unknown as Record<string, unknown> })),
    ).toBe(false);
    expect(isLogEntry(validEntry({ timestamp: 'not-a-date' }))).toBe(false);
  });
});

describe('sanitizePayload — PII redaction', () => {
  it('redacts keys matching secret pattern', () => {
    const result = sanitizePayload({
      password: 'hunter2',
      apiKey: 'abc',
      access_token: 'tok',
      Authorization: 'Bearer x',
      nested: { otp: '123456' },
    });
    expect(result.password).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result.nested).toEqual({ otp: '[REDACTED]' });
  });

  it('redacts string values matching secret-like patterns', () => {
    const result = sanitizePayload({
      message: 'key is sk-ant-abc123',
      header: 'Bearer abcdef',
      cert: '-----BEGIN PRIVATE KEY-----',
      safe: 'hello world',
    });
    expect(result.message).toBe('[REDACTED]');
    expect(result.header).toBe('[REDACTED]');
    expect(result.cert).toBe('[REDACTED]');
    expect(result.safe).toBe('hello world');
  });

  it('redacts arrays recursively, keeps non-secret values', () => {
    const result = sanitizePayload({
      list: ['ok', 'sk-xyz', { secret: 'x' }],
      count: 3,
      flag: true,
    });
    expect(result.list).toEqual(['ok', '[REDACTED]', { secret: '[REDACTED]' }]);
    expect(result.count).toBe(3);
    expect(result.flag).toBe(true);
  });

  it('does not mutate original payload', () => {
    const original = { password: 'hunter2' };
    sanitizePayload(original);
    expect(original.password).toBe('hunter2');
  });
});

describe('handleLogSinkEntry', () => {
  it('invalid entry → INVALID_PAYLOAD error', async () => {
    const buffer = new LogRingBuffer(new FakeDriver());
    const result = await handleLogSinkEntry({ trace_id: 'x' }, buffer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(AppErrorCode.INVALID_PAYLOAD);
  });

  it('valid entry → acknowledged true + persisted sanitized', async () => {
    const driver = new FakeDriver();
    const buffer = new LogRingBuffer(driver);
    const entry = validEntry({ payload: { password: 'hunter2', sk: 'sk-ant-1' } });
    const result = await handleLogSinkEntry(entry, buffer);
    expect(result).toEqual({ ok: true, data: { acknowledged: true } });
    await buffer.flush();
    const read = await driver.get<LogEntry[]>(BUFFER_KEY);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.data[0]?.payload.password).toBe('[REDACTED]');
      expect(read.data[0]?.payload.sk).toBe('[REDACTED]');
    }
  });

  it('valid entry → sanitized payload persisted via driver', async () => {
    const driver = new FakeDriver();
    const buffer = new LogRingBuffer(driver);
    const entry = validEntry({ payload: { password: 'hunter2' } });
    await handleLogSinkEntry(entry, buffer);
    await buffer.flush();
    const read = await driver.get<LogEntry[]>(BUFFER_KEY);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.data[0]?.payload.password).toBe('[REDACTED]');
    }
  });

  it('head increments after valid entries', async () => {
    const driver = new FakeDriver();
    const buffer = new LogRingBuffer(driver);
    await handleLogSinkEntry(validEntry(), buffer);
    await handleLogSinkEntry(validEntry(), buffer);
    await buffer.flush();
    const head = await driver.get<number>(HEAD_KEY);
    expect(head.ok).toBe(true);
    if (head.ok) expect(head.data).toBe(2);
  });
});
