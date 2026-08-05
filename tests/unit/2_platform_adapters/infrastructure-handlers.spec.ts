import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  AppErrorCode,
  type IpcRequestPayload,
  type MessageResponse,
} from '@contracts/ipc-payloads';
import { IpcAction } from '@contracts/ipc-actions';
import { LogLevel, type LogEntry } from '@contracts/log-schema';
import type { Browser } from 'wxt/browser';
import { Router } from '../../../src/2_platform_adapters/ipc/router';

// fake-browser KHÔNG mock runtime.onConnect — spy phải đặt TRƯỚC khi import
// infrastructure-handlers (nó import log-broadcaster → đăng ký listener lúc load).
const spies: Array<(port: Browser.runtime.Port) => void> = [];
const addSpy = vi.spyOn(fakeBrowser.runtime.onConnect, 'addListener');
addSpy.mockImplementation((listener) => {
  spies.push(listener);
});
const { registerInfrastructureHandlers } =
  await import('../../../src/2_platform_adapters/ipc/infrastructure-handlers');
const { portName } = await import('../../../src/2_platform_adapters/telemetry/log-broadcaster');
const emitConnect = (port: Browser.runtime.Port) => {
  for (const listener of spies) listener(port);
};

const entry: LogEntry = {
  trace_id: 'trace-1',
  scope: 'test',
  level: LogLevel.INFO,
  file_line: 'src/test.ts:1',
  decision_reason: 'test entry',
  payload: {},
  timestamp: '2026-08-05T00:00:00.000Z',
};

const makeRequest = (action: IpcAction, extra: Record<string, unknown> = {}): IpcRequestPayload =>
  ({ action, traceId: 'trace-x', ...extra }) as IpcRequestPayload;

/** Fake port đăng ký qua onConnect — dùng cho test broadcast (OBS-3). */
function makePort(name: string): Browser.runtime.Port {
  return {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() } as never,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() } as never,
  };
}

describe('infrastructure-handlers', () => {
  let router: Router;

  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    router = new Router();
    registerInfrastructureHandlers(router);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('LogSink: validate entry → persist → broadcast sanitized entry', async () => {
    const mockPort = makePort(portName);
    emitConnect(mockPort);

    const response = (await router.handle(
      makeRequest(IpcAction.LogSink, { entry }),
    )) as MessageResponse<{ acknowledged: boolean }>;

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.acknowledged).toBe(true);
    }

    // Broadcast tới port (ring buffer batch 100ms — không assert storage trực tiếp).
    const postSpy = vi.mocked(mockPort.postMessage);
    expect(postSpy).toHaveBeenCalled();
    const msg = postSpy.mock.calls[0]?.[0] as { type: string; entry: LogEntry };
    expect(msg.type).toBe('log-entry');
    expect(msg.entry.trace_id).toBe('trace-1');
  });

  it('LogSink: entry không hợp lệ → INVALID_PAYLOAD, không persist', async () => {
    const response = (await router.handle(
      makeRequest(IpcAction.LogSink, { entry: { bad: true } }),
    )) as MessageResponse<{ acknowledged: boolean }>;

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(AppErrorCode.INVALID_PAYLOAD);
    }
    const stored = await fakeBrowser.storage.session.get(['telemetry.logs.buffer']);
    expect(stored['telemetry.logs.buffer']).toBeUndefined();
  });

  it('SettingsGet: key tồn tại trong storage → trả value', async () => {
    await fakeBrowser.storage.local.set({ 'settings.telemetry_enabled': false });

    const response = (await router.handle(
      makeRequest(IpcAction.SettingsGet, { key: 'settings.telemetry_enabled' }),
    )) as MessageResponse<{ value: unknown }>;

    expect(response).toEqual({ ok: true, data: { value: false } });
  });

  it('SettingsGet: key không có trong storage → fallback default (build-config logLevel)', async () => {
    const response = (await router.handle(
      makeRequest(IpcAction.SettingsGet, { key: 'settings.log_level' }),
    )) as MessageResponse<{ value: unknown }>;

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.value).toBeDefined();
    }
  });

  it('SettingsGet: key undefined → { value: undefined }', async () => {
    const response = (await router.handle(makeRequest(IpcAction.SettingsGet))) as MessageResponse<{
      value: unknown;
    }>;

    expect(response).toEqual({ ok: true, data: { value: undefined } });
  });

  it('SettingsSet: ghi value vào storage (đọc lại qua driver)', async () => {
    const response = (await router.handle(
      makeRequest(IpcAction.SettingsSet, { key: 'settings.telemetry_enabled', value: true }),
    )) as MessageResponse<void>;

    expect(response).toEqual({ ok: true, data: undefined });

    const stored = await fakeBrowser.storage.local.get(['settings.telemetry_enabled']);
    expect(stored['settings.telemetry_enabled']).toBe(true);
  });

  it('StorageInspect: đọc nội dung storage theo area', async () => {
    await fakeBrowser.storage.local.set({ 'settings.theme': 'dark' });
    await fakeBrowser.storage.session.set({ 'telemetry.logs.head': 5 });

    const response = (await router.handle(
      makeRequest(IpcAction.StorageInspect, { area: 'local' }),
    )) as MessageResponse<{ data: Record<string, unknown> }>;

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.data['settings.theme']).toBe('dark');
    }

    const sessionResponse = (await router.handle(
      makeRequest(IpcAction.StorageInspect, { area: 'session' }),
    )) as MessageResponse<{ data: Record<string, unknown> }>;

    expect(sessionResponse.ok).toBe(true);
    if (sessionResponse.ok) {
      expect(sessionResponse.data.data['telemetry.logs.head']).toBe(5);
    }
  });

  it('StorageInspect: area undefined → gộp cả 3 area', async () => {
    await fakeBrowser.storage.local.set({ 'settings.theme': 'system' });
    await fakeBrowser.storage.sync.set({ 'settings.sync_preferences': { v: 1 } });

    const response = (await router.handle(
      makeRequest(IpcAction.StorageInspect),
    )) as MessageResponse<{ data: Record<string, unknown> }>;

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.data.local).toEqual(
        expect.objectContaining({ 'settings.theme': 'system' }),
      );
      expect(response.data.data.session).toBeDefined();
      expect(response.data.data.sync).toEqual(
        expect.objectContaining({ 'settings.sync_preferences': { v: 1 } }),
      );
    }
  });
});
