import { LogLevel } from '@contracts/log-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { buildConfig } from '../../../src/2_platform_adapters/config/build-config';
import { localDriver } from '../../../src/2_platform_adapters/storage/local-driver';
import {
  getSetting,
  setSetting,
  subscribe,
} from '../../../src/2_platform_adapters/config/runtime-config-adapter';

describe('runtime-config-adapter', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('getSetting: storage trống → fallback build-config default cho settings.log_level', async () => {
    const result = await getSetting('settings.log_level');
    expect(result).toEqual({ ok: true, data: buildConfig.logLevel });
  });

  it('getSetting: settings.telemetry_enabled fallback default true khi storage trống', async () => {
    const result = await getSetting('settings.telemetry_enabled');
    expect(result).toEqual({ ok: true, data: true });
  });

  it('getSetting: giá trị storage thắng default', async () => {
    await fakeBrowser.storage.local.set({ 'settings.log_level': LogLevel.WARN });
    const result = await getSetting('settings.log_level');
    expect(result).toEqual({ ok: true, data: LogLevel.WARN });
  });

  it('setSetting ghi qua driver đúng area (sync_preferences → sync)', async () => {
    const result = await setSetting('settings.sync_preferences', { theme: 'dark' });
    expect(result).toEqual({ ok: true, data: undefined });
    const syncValue = await fakeBrowser.storage.sync.get('settings.sync_preferences');
    expect(syncValue).toEqual({ 'settings.sync_preferences': { theme: 'dark' } });
    const localValue = await fakeBrowser.storage.local.get('settings.sync_preferences');
    expect(localValue).toEqual({});
  });

  it('getSetting: lỗi storage → fallback default (degradation, không throw)', async () => {
    vi.spyOn(localDriver, 'get').mockRejectedValueOnce(new Error('storage down'));
    const result = await getSetting('settings.telemetry_enabled');
    expect(result).toEqual({ ok: true, data: true });
  });

  it('subscribe nhận changes từ storage.onChanged', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribe(callback);

    await fakeBrowser.storage.local.set({ 'settings.theme': 'dark' });
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    await fakeBrowser.storage.local.set({ 'settings.theme': 'light' });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
