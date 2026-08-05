import { describe, expect, it } from 'vitest';
import {
  heartbeatPayload,
  KEEP_ALIVE_ALARM,
  KEEP_ALIVE_PERIOD_MINUTES,
} from '@engine/background/lifecycle/keep-alive';

describe('keep-alive (D2 — alarm pattern)', () => {
  it('KEEP_ALIVE_ALARM đúng tên alarm', () => {
    expect(KEEP_ALIVE_ALARM).toBe('keep-alive');
  });

  it('period đạt MV3 min (30s = 0.5 phút)', () => {
    expect(KEEP_ALIVE_PERIOD_MINUTES).toBe(0.5);
  });

  it('heartbeatPayload ghi đúng key session.sw_active_timestamp (storage-schema)', () => {
    const payload = heartbeatPayload(1_700_000_000_000);
    expect(payload).toEqual({ 'session.sw_active_timestamp': 1_700_000_000_000 });
  });
});
