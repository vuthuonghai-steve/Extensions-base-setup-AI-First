import { AppErrorCode } from '@contracts/ipc-payloads';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  createStorageDriver,
  type StorageDriver,
} from '../../../src/2_platform_adapters/storage/storage-driver';

const AREAS = ['local', 'session', 'sync'] as const;

describe.each(AREAS)('storage-driver (%s)', (area) => {
  let driver: StorageDriver;

  beforeEach(() => {
    fakeBrowser.reset();
    driver = createStorageDriver(area);
  });

  it('get/set/remove roundtrip theo area', async () => {
    const key = 'settings.theme';
    const setResult = await driver.set({ [key]: 'dark' });
    expect(setResult).toEqual({ ok: true, data: undefined });

    const getResult = await driver.get(key);
    expect(getResult).toEqual({ ok: true, data: 'dark' });

    const removeResult = await driver.remove([key]);
    expect(removeResult).toEqual({ ok: true, data: undefined });

    const afterRemove = await driver.get(key);
    expect(afterRemove).toEqual({ ok: true, data: undefined });
  });

  it('get key chưa tồn tại → undefined', async () => {
    const result = await driver.get('settings.telemetry_enabled');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('getMany gom 1 lần get với nhiều key', async () => {
    await driver.set({
      'settings.theme': 'light',
      'settings.telemetry_enabled': true,
      'settings.log_level': 'DEBUG',
    });
    const result = await driver.getMany(['settings.theme', 'settings.telemetry_enabled']);
    expect(result).toEqual({
      ok: true,
      data: {
        'settings.theme': 'light',
        'settings.telemetry_enabled': true,
      },
    });
  });

  it('set nhiều key chỉ gọi storage.set 1 lần (batch)', async () => {
    const setSpy = vi.spyOn(fakeBrowser.storage[area], 'set');
    await driver.set({
      'settings.theme': 'dark',
      'settings.telemetry_enabled': false,
      'settings.log_level': 'ERROR',
    });
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({
      'settings.theme': 'dark',
      'settings.telemetry_enabled': false,
      'settings.log_level': 'ERROR',
    });
  });

  it('lỗi storage → AppError STORAGE_ERROR, không throw', async () => {
    vi.spyOn(fakeBrowser.storage[area], 'set').mockRejectedValueOnce(new Error('quota exceeded'));
    const result = await driver.set({ 'settings.theme': 'dark' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AppErrorCode.STORAGE_ERROR);
    }
  });

  it('getBytesInUse không throw khi API lỗi — trả AppError STORAGE_ERROR', async () => {
    // fake-browser không implement getBytesInUse (throw) → driver phải bọc thành Result.err
    const result = await driver.getBytesInUse();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(AppErrorCode.STORAGE_ERROR);
    }
  });

  it('subscribe nhận changes khi set, unsubscribe ngừng nhận', async () => {
    const callback = vi.fn();
    const unsubscribe = driver.subscribe(callback);

    await driver.set({ 'settings.theme': 'dark' });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      'settings.theme': { oldValue: null, newValue: 'dark' },
    });

    unsubscribe();
    fakeBrowser.storage[area].resetState();
    await driver.set({ 'settings.theme': 'light' });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
