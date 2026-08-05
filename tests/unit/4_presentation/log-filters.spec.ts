import { describe, expect, it } from 'vitest';
import { LogLevel, type LogEntry } from '@contracts/log-schema';
import { matchesFilters } from '@presentation/extension-views/debug-console-app/log-filters';

const entry: LogEntry = {
  trace_id: 'abc-123',
  scope: 'bookmark-manager',
  level: LogLevel.INFO,
  file_line: 'src/3_modules/x.ts:10',
  decision_reason: 'saved',
  payload: {},
  timestamp: '2026-08-06T00:00:00.000Z',
};

describe('LogViewer filter (D13 — pure logic)', () => {
  it('filter rỗng → pass', () => {
    expect(matchesFilters(entry, { scope: '', level: '', traceId: '' })).toBe(true);
  });

  it('filter scope match substring', () => {
    expect(matchesFilters(entry, { scope: 'bookmark', level: '', traceId: '' })).toBe(true);
    expect(matchesFilters(entry, { scope: 'telemetry', level: '', traceId: '' })).toBe(false);
  });

  it('filter level khớp chính xác', () => {
    expect(matchesFilters(entry, { scope: '', level: 'INFO', traceId: '' })).toBe(true);
    expect(matchesFilters(entry, { scope: '', level: 'ERROR', traceId: '' })).toBe(false);
  });

  it('filter traceId match substring', () => {
    expect(matchesFilters(entry, { scope: '', level: '', traceId: 'abc' })).toBe(true);
    expect(matchesFilters(entry, { scope: '', level: '', traceId: 'zzz' })).toBe(false);
  });

  it('kết hợp nhiều filter — mọi điều kiện phải đúng', () => {
    expect(matchesFilters(entry, { scope: 'bookmark', level: 'INFO', traceId: 'abc' })).toBe(true);
    expect(matchesFilters(entry, { scope: 'bookmark', level: 'ERROR', traceId: 'abc' })).toBe(
      false,
    );
  });
});
