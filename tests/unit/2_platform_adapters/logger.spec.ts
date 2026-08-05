import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogLevel, type LogEntry } from '@contracts/log-schema';
import { createLogger, shouldLog } from '../../../src/2_platform_adapters/telemetry/logger';

describe('shouldLog — level filter (D4)', () => {
  it('entry dưới threshold bị chặn', () => {
    expect(shouldLog(LogLevel.DEBUG, LogLevel.WARN)).toBe(false);
    expect(shouldLog(LogLevel.INFO, LogLevel.WARN)).toBe(false);
  });

  it('entry bằng/trên threshold được ghi', () => {
    expect(shouldLog(LogLevel.WARN, LogLevel.WARN)).toBe(true);
    expect(shouldLog(LogLevel.ERROR, LogLevel.WARN)).toBe(true);
    expect(shouldLog(LogLevel.FATAL, LogLevel.WARN)).toBe(true);
  });
});

describe('createLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('trả về object đủ 6 method (5 level + traceId)', () => {
    const logger = createLogger('test-scope');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
    expect(typeof logger.traceId).toBe('function');
  });

  it('transport nhận LogEntry hợp lệ — trace_id tồn tại, file_line != unknown, timestamp ISO', () => {
    const transport = vi.fn();
    const logger = createLogger('test-scope', { transport });

    logger.info('hello world', { count: 1 });

    expect(transport).toHaveBeenCalledTimes(1);
    const entry = transport.mock.calls[0]?.[0] as LogEntry;
    expect(entry).toBeDefined();
    expect(entry.trace_id.length).toBeGreaterThan(0);
    expect(entry.scope).toBe('test-scope');
    expect(entry.level).toBe(LogLevel.INFO);
    expect(entry.file_line).not.toBe('unknown');
    expect(entry.decision_reason).toBe('hello world');
    expect(entry.payload).toEqual({ count: 1 });
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  it('traceId() tái dùng cho mọi entry của cùng instance (correlation)', () => {
    const transport = vi.fn();
    const logger = createLogger('test-scope', { transport });

    logger.warn('first');
    logger.error('second');

    const entries = transport.mock.calls.map((c) => c[0] as LogEntry);
    expect(entries[0]?.trace_id).toBe(entries[1]?.trace_id);
    expect(entries[0]?.trace_id).toBe(logger.traceId());
  });

  it('custom transport override — mặc định không gửi IPC (test env)', () => {
    const transport = vi.fn();
    const logger = createLogger('test-scope', { transport });

    logger.debug('debug msg');
    logger.info('info msg');

    expect(transport).toHaveBeenCalledTimes(2);
  });
});
