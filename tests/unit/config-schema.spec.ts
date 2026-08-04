import { describe, expect, it } from 'vitest';
import { validateEnv } from '@contracts/config-schema';

describe('config-schema validateEnv', () => {
  it('pass khi đủ 2 biến bắt buộc', () => {
    const result = validateEnv({ WXT_APP_NAME: 'App', WXT_APP_DESCRIPTION: 'Desc' });
    expect(result.WXT_APP_NAME).toBe('App');
  });

  it('throw khi thiếu WXT_APP_NAME (CFG-2)', () => {
    expect(() => validateEnv({ WXT_APP_DESCRIPTION: 'Desc' })).toThrow();
  });

  it('throw khi thiếu WXT_APP_DESCRIPTION (CFG-2)', () => {
    expect(() => validateEnv({ WXT_APP_NAME: 'App' })).toThrow();
  });

  it('throw khi giá trị rỗng', () => {
    expect(() => validateEnv({ WXT_APP_NAME: '', WXT_APP_DESCRIPTION: 'Desc' })).toThrow();
  });
});
