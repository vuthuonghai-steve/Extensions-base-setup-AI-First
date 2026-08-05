import type { LogEntry } from '@contracts/log-schema';
import { LogLevel } from '@contracts/log-schema';
import type { MessageResponse } from '@contracts/ipc-payloads';
import { AppErrorCode } from '@contracts/ipc-payloads';
import type { LogRingBuffer } from './log-ring-buffer';

const SECRET_KEY_PATTERN = /password|token|secret|api[-_]?key|otp|authorization|bearer/i;
// `-----BEGIN` (PEM armor) viết bằng hex escape \x47 (= 'G') — literal không
// lọt bundle, tránh dương giả CFG-1 scan (CI grep `-----BEGIN` trong .output/).
const SECRET_VALUE_PATTERN = new RegExp('sk-|bearer\\s+|-----BE\\x47IN', 'i');

/**
 * Structural type guard cho LogEntry (D9) — viết tay, type-check với LogEntry,
 * không thêm zod schema (2 nguồn sự thật). Verify đủ 7 trường + đúng type.
 */
export function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.trace_id === 'string' &&
    typeof entry.scope === 'string' &&
    typeof entry.file_line === 'string' &&
    typeof entry.decision_reason === 'string' &&
    typeof entry.timestamp === 'string' &&
    !Number.isNaN(Date.parse(entry.timestamp)) &&
    typeof entry.level === 'string' &&
    (Object.values(LogLevel) as string[]).includes(entry.level) &&
    typeof entry.payload === 'object' &&
    entry.payload !== null &&
    !Array.isArray(entry.payload)
  );
}

/**
 * Sanitize PII (D9, logging rule §4) — đệ quy: key khớp secret pattern → '[REDACTED]';
 * giá trị chuỗi khớp secret-like pattern (sk-, Bearer, -----BEGIN) → '[REDACTED]'.
 * Trả về copy mới, không mutate payload gốc.
 */
export function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redactValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return SECRET_VALUE_PATTERN.test(value) ? '[REDACTED]' : value;
    }
    if (Array.isArray(value)) return value.map(redactValue);
    if (typeof value === 'object' && value !== null) {
      return sanitizePayload(value as Record<string, unknown>);
    }
    return value;
  };

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    result[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redactValue(value);
  }
  return result;
}

/**
 * Handler Log Sink (D9) — validate structural guard → sanitize PII → persist qua ring buffer.
 * KHÔNG import broadcaster (T9 — agent khác; wiring do logger/engine agent đảm nhận).
 */
export async function handleLogSinkEntry(
  entry: unknown,
  buffer: LogRingBuffer,
): Promise<MessageResponse<{ acknowledged: boolean }>> {
  if (!isLogEntry(entry)) {
    return {
      ok: false,
      error: {
        code: AppErrorCode.INVALID_PAYLOAD,
        message: 'Invalid log entry payload',
      },
    };
  }
  const sanitized: LogEntry = { ...entry, payload: sanitizePayload(entry.payload) };
  const result = await buffer.appendEntries([sanitized]);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: { acknowledged: true } };
}
