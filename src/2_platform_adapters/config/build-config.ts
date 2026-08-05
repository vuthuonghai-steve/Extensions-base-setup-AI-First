import { LogLevel } from '@contracts/log-schema';

const DEFAULT_LOG_LEVEL = LogLevel.INFO;

const RAW_LOG_LEVELS: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

/**
 * Parse giá trị `WXT_LOG_LEVEL` (lowercase, từ config-schema) → LogLevel.
 * - 'debug' | 'info' | 'warn' | 'error' → LogLevel tương ứng.
 * - 'fatal' KHÔNG set được qua env (giữ INFO).
 * - Không hợp lệ / thiếu → default INFO.
 * Tách riêng để unit-test thuần (import.meta.env bị Vite thay tĩnh lúc build).
 */
export function parseLogLevel(raw: string | undefined): LogLevel {
  if (raw === undefined) return DEFAULT_LOG_LEVEL;
  return RAW_LOG_LEVELS[raw.trim().toLowerCase()] ?? DEFAULT_LOG_LEVEL;
}

const env = import.meta.env as Record<string, string | undefined>;

/**
 * Config public build-time (rule config-and-environment §3).
 * Giá trị khóa tại lúc build — read-only, resolve MỘT LẦN tại module load.
 * Nguồn duy nhất đọc import.meta.env — không đọc env ở nơi khác.
 */
export const buildConfig: Readonly<{
  mode: string;
  isDev: boolean;
  isProd: boolean;
  appName: string;
  appDescription: string;
  logLevel: LogLevel;
}> = Object.freeze({
  mode: env.MODE ?? 'production',
  isDev: env.DEV === 'true',
  isProd: env.PROD === 'true',
  appName: env.WXT_APP_NAME ?? '',
  appDescription: env.WXT_APP_DESCRIPTION ?? '',
  logLevel: parseLogLevel(env.WXT_LOG_LEVEL),
});
