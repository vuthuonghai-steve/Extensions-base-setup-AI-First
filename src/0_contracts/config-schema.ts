import { z } from 'zod';

export const envSchema = z.object({
  WXT_APP_NAME: z.string().min(1, 'WXT_APP_NAME là bắt buộc'),
  WXT_APP_DESCRIPTION: z.string().min(1, 'WXT_APP_DESCRIPTION là bắt buộc'),
  // Monitoring/observability: mức log nền tảng telemetry (Phase 3 — ADR-003).
  // Optional để không làm build fail khi thiếu; nếu set phải hợp lệ.
  WXT_LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info')
    .describe('Mức log telemetry — monitoring baseline (ADR-003)'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(raw); // throw ZodError khi thiếu biến → exit 1 (CFG-2)
}
