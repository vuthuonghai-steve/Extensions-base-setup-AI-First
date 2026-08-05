import type { LogEntry } from '@contracts/log-schema';

/** Giới hạn entries giữ trong bộ nhớ (FIFO) — tránh rò rỉ khi stream dài. */
export const MAX_VISIBLE_ENTRIES = 500;

export interface LogFilters {
  scope: string;
  level: string;
  traceId: string;
}

/** Pure filter — test trực tiếp (D13). */
export function matchesFilters(entry: LogEntry, filters: LogFilters): boolean {
  if (filters.scope !== '' && !entry.scope.includes(filters.scope)) return false;
  if (filters.level !== '' && entry.level !== (filters.level as LogEntry['level'])) return false;
  if (filters.traceId !== '' && !entry.trace_id.includes(filters.traceId)) return false;
  return true;
}
