/**
 * Log severity levels.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

/**
 * Standard log entry format for wide events (ADR-003, OBS-1).
 * Single source of truth for telemetry and logging schema across all execution contexts.
 */
export interface LogEntry {
  trace_id: string;
  scope: string;
  level: LogLevel;
  file_line: string;
  decision_reason: string;
  payload: Record<string, unknown>;
  /** ISO-8601 UTC — vd "2026-07-27T05:30:00.000Z" (logging-and-observability rule §3). */
  timestamp: string;
}
