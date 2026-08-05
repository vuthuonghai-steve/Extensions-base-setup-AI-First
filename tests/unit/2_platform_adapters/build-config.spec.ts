import { describe, expect, it } from 'vitest';
import { LogLevel } from '@contracts/log-schema';
import { buildConfig, parseLogLevel } from '@platform/config/build-config';

describe('parseLogLevel (pure — import.meta.env bị Vite thay tĩnh lúc build)', () => {
  it('map lowercase hợp lệ → LogLevel', () => {
    expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
    expect(parseLogLevel('info')).toBe(LogLevel.INFO);
    expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
    expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
  });

  it('case-insensitive + trim', () => {
    expect(parseLogLevel('  DEBUG ')).toBe(LogLevel.DEBUG);
    expect(parseLogLevel('Info')).toBe(LogLevel.INFO);
  });

  it('fatal không set được qua env → default INFO', () => {
    expect(parseLogLevel('fatal')).toBe(LogLevel.INFO);
  });

  it('giá trị không hợp lệ → default INFO', () => {
    expect(parseLogLevel('verbose')).toBe(LogLevel.INFO);
    expect(parseLogLevel('')).toBe(LogLevel.INFO);
  });

  it("undefined (env default 'info' theo config-schema) → INFO", () => {
    expect(parseLogLevel(undefined)).toBe(LogLevel.INFO);
  });
});

describe('buildConfig (static const — resolved lúc module load)', () => {
  it('tồn tại, đóng băng (Object.freeze)', () => {
    expect(Object.isFrozen(buildConfig)).toBe(true);
  });

  it('có đủ 6 field đúng shape', () => {
    expect(typeof buildConfig.mode).toBe('string');
    expect(typeof buildConfig.isDev).toBe('boolean');
    expect(typeof buildConfig.isProd).toBe('boolean');
    expect(typeof buildConfig.appName).toBe('string');
    expect(typeof buildConfig.appDescription).toBe('string');
    expect(Object.values(LogLevel)).toContain(buildConfig.logLevel);
  });
});
