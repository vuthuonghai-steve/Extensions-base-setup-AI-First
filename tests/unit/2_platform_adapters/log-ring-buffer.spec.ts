import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { LogEntry } from '@contracts/log-schema';
import { LogLevel } from '@contracts/log-schema';
import type { Result } from '@platform/telemetry/log-ring-buffer';
import type { StorageValue } from '@platform/storage/storage-driver';
import type { StorageKey } from '@contracts/storage-schema';
import { AppErrorCode } from '@contracts/ipc-payloads';
import {
  LogRingBuffer,
  MAX_ENTRIES,
  LOG_BUDGET_BYTES,
  BATCH_WINDOW_MS,
  BUFFER_KEY,
  HEAD_KEY,
  estimateEntryBytes,
  evictToBudget,
} from '@platform/telemetry/log-ring-buffer';

function makeEntry(seed: number, extraPayload: Record<string, unknown> = {}): LogEntry {
  return {
    trace_id: `trace-${seed}`,
    scope: 'test',
    level: LogLevel.INFO,
    file_line: 'tests/unit/2_platform_adapters/log-ring-buffer.spec.ts:1',
    decision_reason: `entry ${seed}`,
    payload: { seed, ...extraPayload },
    timestamp: '2026-08-05T00:00:00.000Z',
  };
}

class FakeDriver {
  private store = new Map<string, unknown>();
  private bytesInUse = 0;
  setCalls = 0;
  onSet: (values: Record<string, unknown>) => void = () => undefined;

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
    this.setCalls += 1;
    for (const [key, value] of Object.entries(values)) {
      this.store.set(key, value);
    }
    this.onSet(values);
    return Promise.resolve({ ok: true, data: undefined });
  }

  getBytesInUse(): Promise<Result<number>> {
    return Promise.resolve({ ok: true, data: this.bytesInUse });
  }

  setBytesInUse(bytes: number): void {
    this.bytesInUse = bytes;
  }

  readBuffer(): LogEntry[] {
    return this.store.get(BUFFER_KEY) as LogEntry[];
  }

  readHead(): number {
    return this.store.get(HEAD_KEY) as number;
  }
}

describe('LogRingBuffer — append & head', () => {
  let driver: FakeDriver;
  let buffer: LogRingBuffer;

  beforeEach(() => {
    driver = new FakeDriver();
    buffer = new LogRingBuffer(driver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('appendEntries increments head (monotonic counter)', async () => {
    await buffer.appendEntries([makeEntry(1), makeEntry(2)]);
    await buffer.flush();
    expect(driver.readHead()).toBe(2);
    expect(driver.readBuffer()).toHaveLength(2);
  });

  it('cap FIFO: append 510 entries → buffer length ≤ 500, oldest dropped', async () => {
    const entries = Array.from({ length: 510 }, (_, i) => makeEntry(i));
    await buffer.appendEntries(entries);
    await buffer.flush();
    const stored = driver.readBuffer();
    expect(stored).toHaveLength(MAX_ENTRIES);
    expect(stored?.[0]?.trace_id).toBe('trace-10');
    expect(stored?.[499]?.trace_id).toBe('trace-509');
  });

  it('readBuffer returns merged pending entries without flush', async () => {
    await buffer.appendEntries([makeEntry(1)]);
    const result = await buffer.readBuffer();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.map((e) => e.trace_id)).toEqual(['trace-1']);
  });

  it('getHead returns 0 when storage empty', async () => {
    const result = await buffer.getHead();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);
  });

  it('flush with empty pending is a no-op', async () => {
    const result = await buffer.flush();
    expect(result.ok).toBe(true);
    expect(driver.setCalls).toBe(0);
  });
});

describe('LogRingBuffer — batching (windowing)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('multiple appends within window → single storage.set', async () => {
    const driver = new FakeDriver();
    const buffer = new LogRingBuffer(driver);
    await buffer.appendEntries([makeEntry(1)]);
    await buffer.appendEntries([makeEntry(2)]);
    await buffer.appendEntries([makeEntry(3)]);
    expect(driver.setCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);
    expect(driver.setCalls).toBe(1);
    expect(driver.readBuffer()).toHaveLength(3);
    expect(driver.readHead()).toBe(3);
  });

  it('append beyond MAX_ENTRIES flushes immediately', async () => {
    const driver = new FakeDriver();
    const buffer = new LogRingBuffer(driver);
    const entries = Array.from({ length: MAX_ENTRIES }, (_, i) => makeEntry(i));
    await buffer.appendEntries(entries);
    expect(driver.setCalls).toBe(1);
    expect(driver.readHead()).toBe(MAX_ENTRIES);
    await buffer.appendEntries([makeEntry(MAX_ENTRIES)]);
    await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);
    expect(driver.readHead()).toBe(MAX_ENTRIES + 1);
  });
});

describe('estimateEntryBytes / evictToBudget (pure functions)', () => {
  it('estimateEntryBytes returns JSON length', () => {
    const entry = makeEntry(1, { big: 'x'.repeat(100) });
    expect(estimateEntryBytes(entry)).toBe(JSON.stringify(entry).length);
  });

  it('evictToBudget keeps all when under budget and under cap', () => {
    const entries = [makeEntry(1), makeEntry(2)];
    expect(evictToBudget(entries, 10_000)).toEqual(entries);
  });

  it('evictToBudget drops oldest when byte budget exceeded', () => {
    const entries = [makeEntry(1, { pad: 'x'.repeat(500) }), makeEntry(2), makeEntry(3)];
    const budget =
      estimateEntryBytes(entries[2] ?? entries[0]!) +
      estimateEntryBytes(entries[1] ?? entries[0]!) +
      10;
    const evicted = evictToBudget(entries, budget);
    expect(evicted.length).toBeLessThan(entries.length);
    expect(evicted[0]?.trace_id).toBe('trace-2');
    expect(evicted[1]?.trace_id).toBe('trace-3');
  });

  it('evictToBudget respects MAX_ENTRIES cap', () => {
    const entries = Array.from({ length: MAX_ENTRIES + 10 }, (_, i) => makeEntry(i));
    const evicted = evictToBudget(entries, LOG_BUDGET_BYTES);
    expect(evicted).toHaveLength(MAX_ENTRIES);
    expect(evicted[0]?.trace_id).toBe('trace-10');
  });

  it('evictToBudget returns [] for empty input or zero budget', () => {
    expect(evictToBudget([], 100)).toEqual([]);
    expect(evictToBudget([makeEntry(1)], 0)).toEqual([]);
  });
});

describe('LogRingBuffer — quota failure path', () => {
  it('storage.set failure → Result error, not throw', async () => {
    const driver = new FakeDriver();
    driver.set = () =>
      Promise.resolve({ ok: false, error: { code: AppErrorCode.STORAGE_ERROR, message: 'quota' } });
    const buffer = new LogRingBuffer(driver);
    const result = await buffer.appendEntries([makeEntry(1)]);
    expect(result.ok).toBe(true);
    const flushResult = await buffer.flush();
    expect(flushResult.ok).toBe(false);
  });

  it('getBytesInUse huge → evict everything → still returns ok', async () => {
    const driver = new FakeDriver();
    driver.setBytesInUse(LOG_BUDGET_BYTES + 10_000_000);
    const buffer = new LogRingBuffer(driver);
    await buffer.appendEntries([makeEntry(1)]);
    const result = await buffer.flush();
    expect(result.ok).toBe(true);
    expect(driver.readBuffer()).toEqual([]);
  });
});

describe('fake-browser smoke (vi.stubGlobal)', () => {
  it('global browser storage.session works', async () => {
    vi.stubGlobal('browser', fakeBrowser);
    await fakeBrowser.storage.session.set({ [BUFFER_KEY]: [makeEntry(1)] });
    const got = await fakeBrowser.storage.session.get(BUFFER_KEY);
    expect(got[BUFFER_KEY]).toHaveLength(1);
  });
});
