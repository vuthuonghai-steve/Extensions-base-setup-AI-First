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

describe('config-schema WXT_LOG_LEVEL (monitoring baseline)', () => {
  it('default info khi không set', () => {
    const result = validateEnv({ WXT_APP_NAME: 'App', WXT_APP_DESCRIPTION: 'Desc' });
    expect(result.WXT_LOG_LEVEL).toBe('info');
  });

  it('chấp nhận giá trị enum hợp lệ', () => {
    const result = validateEnv({
      WXT_APP_NAME: 'App',
      WXT_APP_DESCRIPTION: 'Desc',
      WXT_LOG_LEVEL: 'error',
    });
    expect(result.WXT_LOG_LEVEL).toBe('error');
  });

  it('throw khi giá trị ngoài enum', () => {
    expect(() =>
      validateEnv({ WXT_APP_NAME: 'App', WXT_APP_DESCRIPTION: 'Desc', WXT_LOG_LEVEL: 'verbose' }),
    ).toThrow();
  });
});
