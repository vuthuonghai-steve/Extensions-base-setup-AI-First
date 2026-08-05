import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorCode } from '@contracts/ipc-payloads';
import { fakeBrowser } from 'wxt/testing/fake-browser';

vi.mock('@platform/storage/session-driver', () => ({
  sessionDriver: {
    set: vi.fn(() => Promise.resolve({ ok: true, data: undefined })),
    getMany: vi.fn(() =>
      Promise.resolve({ ok: true, data: { 'session.sw_active_timestamp': 123 } }),
    ),
    get: vi.fn(),
    remove: vi.fn(),
    getBytesInUse: vi.fn(),
    subscribe: vi.fn((): (() => void) => () => undefined),
  },
}));

import { loadSessionState, saveSessionState } from '@engine/background/state/session-cache';
import { sessionDriver } from '@platform/storage/session-driver';

const mocked = vi.mocked(sessionDriver);

describe('session-cache (T3 — State Persistence Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveSessionState set đúng values qua session driver', async () => {
    await saveSessionState({ 'session.sw_active_timestamp': 42 });
    expect(mocked.set.mock.calls).toEqual([[{ 'session.sw_active_timestamp': 42 }]]);
  });

  it('saveSessionState không throw khi driver lỗi (graceful degradation)', async () => {
    mocked.set.mockResolvedValueOnce({
      ok: false,
      error: { code: AppErrorCode.STORAGE_ERROR, message: 'fail' },
    });
    await expect(saveSessionState({ 'session.sw_active_timestamp': 1 })).resolves.toBeUndefined();
  });

  it('loadSessionState trả data đã đọc', async () => {
    const data = await loadSessionState(['session.sw_active_timestamp']);
    expect(mocked.getMany.mock.calls).toEqual([[['session.sw_active_timestamp']]]);
    expect(data).toEqual({ 'session.sw_active_timestamp': 123 });
  });
});

void fakeBrowser;
