import { z } from 'zod';

export const envSchema = z.object({
  WXT_APP_NAME: z.string().min(1, 'WXT_APP_NAME là bắt buộc'),
  WXT_APP_DESCRIPTION: z.string().min(1, 'WXT_APP_DESCRIPTION là bắt buộc'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(raw); // throw ZodError khi thiếu biến → exit 1 (CFG-2)
}
