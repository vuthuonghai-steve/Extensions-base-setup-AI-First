import { describe, expect, it } from 'vitest';
import { envSchema } from '@contracts/config-schema';

describe('smoke: alias @contracts resolve', () => {
  it('import từ @contracts hoạt động', () => {
    expect(envSchema).toBeDefined();
    expect(envSchema.shape.WXT_APP_NAME).toBeDefined();
  });
});
