import { describe, expect, it } from 'vitest';
import { formatDate, formatRelativeTime } from '@modules/sub-modules/time-formatter/index';

describe('time-formatter', () => {
  it('formatDate: ISO hợp lệ → locale string', () => {
    const result = formatDate('2026-08-06T00:00:00.000Z');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });

  it('formatDate: ISO không hợp lệ → err, không throw', () => {
    const result = formatDate('not-a-date');
    expect(result).toEqual({ ok: false, error: 'invalid ISO date: not-a-date' });
  });

  it('formatRelativeTime: vài phút trước → "5 minutes ago"', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const result = formatRelativeTime('2026-08-06T11:55:00.000Z', now);
    expect(result).toEqual({ ok: true, data: '5 minutes ago' });
  });

  it('formatRelativeTime: dưới 1 phút → "just now"', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const result = formatRelativeTime('2026-08-06T11:59:30.000Z', now);
    expect(result).toEqual({ ok: true, data: 'just now' });
  });

  it('formatRelativeTime: tương lai → err', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const result = formatRelativeTime('2026-08-06T13:00:00.000Z', now);
    expect(result.ok).toBe(false);
  });
});
