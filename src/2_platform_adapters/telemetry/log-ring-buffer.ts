import type { LogEntry } from '@contracts/log-schema';
import type { StorageKey } from '@contracts/storage-schema';
import { AppErrorCode } from '@contracts/ipc-payloads';
import type { Result, StorageDriver } from '../storage/storage-driver';

export { type Result };

export const BUFFER_KEY: StorageKey = 'telemetry.logs.buffer';
export const HEAD_KEY: StorageKey = 'telemetry.logs.head';
/** FIFO cap — số entries tối đa trong buffer (storage rule §7–§8). */
export const MAX_ENTRIES = 500;
/** Ngân sách log riêng trong session 10MB (storage rule §7): 4MB log / 6MB SW cache. */
export const LOG_BUDGET_BYTES = 4 * 1024 * 1024;
/** Cửa sổ batch append — gom log trong 100ms rồi flush 1 lần storage.set (D5, R9). */
export const BATCH_WINDOW_MS = 100;

/**
 * Ước lượng byte của entry = kích thước JSON serialized (evict theo byte — storage rule §7–§8).
 */
export function estimateEntryBytes(entry: LogEntry): number {
  try {
    return JSON.stringify(entry).length;
  } catch {
    return 0;
  }
}

/**
 * Evict FIFO: giữ suffix mới nhất sao cho tổng byte ước lượng ≤ budgetBytes
 * và độ dài ≤ MAX_ENTRIES (đánh rơi entry cũ nhất trước). Pure function — test trực tiếp.
 */
export function evictToBudget(entries: LogEntry[], budgetBytes: number): LogEntry[] {
  if (entries.length === 0 || budgetBytes <= 0) return [];
  const kept: LogEntry[] = [];
  let total = 0;
  for (let i = entries.length - 1; i >= 0 && kept.length < MAX_ENTRIES; i -= 1) {
    const entry = entries[i];
    if (entry === undefined) break;
    total += estimateEntryBytes(entry);
    if (total > budgetBytes) break;
    kept.unshift(entry);
  }
  return kept;
}

/**
 * Ring buffer log (D5) — FIFO cap 500 + head monotonic counter + evict theo byte
 * + batch append 100ms. KHÔNG import logger (R5 — tránh vòng import với log-sink);
 * quota fail → fallback memory (non-durable) + trả Err, không throw.
 */
export class LogRingBuffer {
  private readonly driver: StorageDriver;
  /** Bộ đệm in-memory giữa các lần flush — bị mất nếu SW bị kill (chấp nhận, D5). */
  private pending: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private memoryFallback: LogEntry[] = [];

  constructor(driver: StorageDriver) {
    this.driver = driver;
  }

  /** Append entries — gom vào pending, flush sau BATCH_WINDOW_MS (1 storage.set cho cả lô). */
  appendEntries(entries: LogEntry[]): Promise<Result<void>> {
    if (entries.length === 0) return Promise.resolve({ ok: true, data: undefined });
    this.pending.push(...entries);
    if (this.pending.length >= MAX_ENTRIES) return this.flush();
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, BATCH_WINDOW_MS);
    }
    return Promise.resolve({ ok: true, data: undefined });
  }

  /** Đọc buffer hiện tại (đã gồm pending chưa flush). */
  async readBuffer(): Promise<Result<LogEntry[]>> {
    const stored = await this.driver.get(BUFFER_KEY);
    if (!stored.ok) {
      return { ok: true, data: this.pending.length > 0 ? this.pending : this.memoryFallback };
    }
    const buffer = Array.isArray(stored.data) ? stored.data : [];
    const merged = this.pending.length > 0 ? [...buffer, ...this.pending] : buffer;
    return { ok: true, data: this.mergeWithFallback(merged) };
  }

  async getHead(): Promise<Result<number>> {
    const head = await this.driver.get(HEAD_KEY);
    if (!head.ok) return { ok: true, data: 0 };
    return { ok: true, data: typeof head.data === 'number' && head.data >= 0 ? head.data : 0 };
  }

  /** Force flush ngay — dùng trong test và khi pending chạm MAX_ENTRIES. */
  async flush(): Promise<Result<void>> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pending.length === 0) return { ok: true, data: undefined };

    const entries = this.pending;
    this.pending = [];
    try {
      const [currentRes, headRes, inUseRes] = await Promise.all([
        this.driver.get(BUFFER_KEY),
        this.driver.get(HEAD_KEY),
        this.driver.getBytesInUse(),
      ]);
      const buffer = currentRes.ok && Array.isArray(currentRes.data) ? currentRes.data : [];
      const head = headRes.ok && typeof headRes.data === 'number' ? headRes.data : 0;
      const inUseBytes = inUseRes.ok ? inUseRes.data : 0;

      const merged = this.mergeWithFallback([...buffer, ...entries]);
      const budget = Math.max(LOG_BUDGET_BYTES - inUseBytes, 0);
      const evicted = evictToBudget(merged, budget);
      const droppedCount = merged.length - evicted.length;
      if (droppedCount > 0) {
        this.memoryFallback = merged.slice(0, droppedCount);
      } else if (evicted.length === 0) {
        this.memoryFallback = merged;
      }

      const setResult = await this.driver.set({
        [BUFFER_KEY]: evicted,
        [HEAD_KEY]: head + entries.length,
      });
      if (!setResult.ok) {
        this.memoryFallback = [...this.memoryFallback, ...entries];
        return { ok: false, error: setResult.error };
      }
      return { ok: true, data: undefined };
    } catch {
      this.memoryFallback = [...this.memoryFallback, ...entries];
      return {
        ok: false,
        error: { code: AppErrorCode.STORAGE_ERROR, message: 'Ring buffer flush failed' },
      };
    }
  }

  /** Ghép buffer lưu trữ với fallback memory (non-durable) — bảo toàn log khi quota fail. */
  private mergeWithFallback(stored: LogEntry[]): LogEntry[] {
    if (this.memoryFallback.length === 0) return stored;
    return evictToBudget([...this.memoryFallback, ...stored], LOG_BUDGET_BYTES);
  }
}
