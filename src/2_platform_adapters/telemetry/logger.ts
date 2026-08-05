import { LogLevel, type LogEntry } from '@contracts/log-schema';
import { IpcAction } from '@contracts/ipc-actions';
import { buildConfig } from '../config/build-config';
import { createTraceId } from './trace-id';
import { sendMessage } from '../ipc/sender';

/**
 * Thứ tự severity — DEBUG < INFO < WARN < ERROR < FATAL (level filter D4).
 */
const LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
};

/**
 * Quyết định entry có được ghi không dựa trên threshold (build-config logLevel).
 * Pure function — test trực tiếp không cần mock buildConfig.
 */
export function shouldLog(entryLevel: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_ORDER[entryLevel] >= LEVEL_ORDER[threshold];
}

/** Console method mirror theo level (OBS-1 — logger.ts là file duy nhất được phép console.*). */
const CONSOLE_METHOD: Record<LogLevel, 'log' | 'info' | 'warn' | 'error'> = {
  [LogLevel.DEBUG]: 'log',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.FATAL]: 'error',
};

const STACK_FRAME_RE = /at (.+?):(\d+):\d+/;

/**
 * Auto-capture file_line từ stack của caller — frame đầu tiên NẰM NGOÀI logger.ts
 * (frame của chính logger bị bỏ qua). Format `src/...:LINE`, fallback 'unknown'.
 */
function captureFileLine(stack: string | undefined): string {
  if (stack === undefined) return 'unknown';
  for (const line of stack.split('\n').slice(1)) {
    const match = STACK_FRAME_RE.exec(line);
    if (match === null || match[1] === undefined || match[2] === undefined) continue;
    if (match[1].includes('logger.ts')) continue;
    return `${match[1]}:${match[2]}`;
  }
  return 'unknown';
}

export interface LoggerOptions {
  /** Ghi đè transport mặc định (IPC LogSink) — Background Phase 5 truyền direct → log-sink. */
  transport?: (entry: LogEntry) => void;
}

export interface Logger {
  debug(message: string, payload?: Record<string, unknown>): void;
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
  error(message: string, payload?: Record<string, unknown>): void;
  fatal(message: string, payload?: Record<string, unknown>): void;
  /** Correlation id của instance — gắn vào mọi entry để nối chuỗi nhân-quả (ADR-003). */
  traceId(): string;
}

/**
 * Factory logger theo scope (Architect §6.2 — mỗi execution context một instance).
 * Mỗi call: build LogEntry (trace_id tái dùng từ instance, file_line auto-capture,
 * timestamp ISO-8601), filter theo buildConfig.logLevel, mirror console, rồi đẩy
 * qua transport (mặc định: IPC LogSink fire-and-forget, retry=0 — D6).
 * KHÔNG throw — lỗi transport nuốt im lặng để log không làm hỏng luồng nghiệp vụ.
 */
export function createLogger(scope: string, opts: LoggerOptions = {}): Logger {
  const traceId = createTraceId();
  const threshold = buildConfig.logLevel;
  const transport =
    opts.transport ??
    ((entry: LogEntry) => {
      void sendMessage(IpcAction.LogSink, { entry }, { retries: 0 });
    });

  const log = (level: LogLevel, message: string, payload?: Record<string, unknown>): void => {
    if (!shouldLog(level, threshold)) return;
    const entry: LogEntry = {
      trace_id: traceId,
      scope,
      level,
      file_line: captureFileLine(new Error().stack),
      decision_reason: message,
      payload: payload ?? {},
      timestamp: new Date().toISOString(),
    };
    console[CONSOLE_METHOD[level]](`[${level}] [${scope}] ${message}`);
    try {
      transport(entry);
    } catch {
      // Fire-and-forget: log không được phép crash luồng nghiệp vụ (D4).
    }
  };

  return {
    debug: (m, p) => log(LogLevel.DEBUG, m, p),
    info: (m, p) => log(LogLevel.INFO, m, p),
    warn: (m, p) => log(LogLevel.WARN, m, p),
    error: (m, p) => log(LogLevel.ERROR, m, p),
    fatal: (m, p) => log(LogLevel.FATAL, m, p),
    traceId: () => traceId,
  };
}
