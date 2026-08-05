import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { IpcRequestPayload } from '@contracts/ipc-payloads';
import { IpcAction } from '@contracts/ipc-actions';
import type { MessageResponse } from '@contracts/ipc-payloads';
import { Router } from '@platform/ipc/router';
import { registerMessageListener } from '@engine/background/listeners/message-listener';

function setupRouter(): Router {
  const router = new Router();
  router.registerHandler(IpcAction.SettingsGet, (request) =>
    Promise.resolve({
      ok: true,
      data: { value: `echo:${(request as { key?: string }).key ?? ''}` },
    }),
  );
  return router;
}

describe('message-listener (T3 — route thuần)', () => {
  beforeEach(() => {
    fakeBrowser.runtime.onMessage.removeAllListeners();
  });

  it('route IPC request tới router.handle và trả MessageResponse', async () => {
    registerMessageListener(setupRouter());
    const request: IpcRequestPayload = {
      action: IpcAction.SettingsGet,
      traceId: 'trace-1',
      key: 'settings.theme',
    };
    const response = (await fakeBrowser.runtime.sendMessage(
      request,
    )) as unknown as MessageResponse<unknown>;
    expect(response).toEqual({ ok: true, data: { value: 'echo:settings.theme' } });
  });

  it('message không phải IPC → undefined (không route)', async () => {
    registerMessageListener(setupRouter());
    const response = (await fakeBrowser.runtime.sendMessage({ hello: 'world' })) as unknown;
    expect(response).toBeUndefined();
  });

  it('router không có handler → error response (router không throw)', async () => {
    registerMessageListener(new Router());
    const request: IpcRequestPayload = {
      action: IpcAction.SettingsGet,
      traceId: 'trace-2',
      key: 'settings.theme',
    };
    const response = (await fakeBrowser.runtime.sendMessage(
      request,
    )) as unknown as MessageResponse<unknown>;
    expect(response).toMatchObject({ ok: false });
  });
});
