import { type StorageKey } from '@contracts/storage-schema';
import { browser, type Browser } from 'wxt/browser';
import { localDriver } from '../storage/local-driver';
import { syncDriver } from '../storage/sync-driver';
import {
  type Result,
  type StorageChangeMap,
  type StorageDriver,
  type StorageValue,
} from '../storage/storage-driver';
import { buildConfig } from './build-config';

/**
 * Config runtime (người dùng chỉnh) — bọc 3 storage drivers (config rule §3).
 * Fallback build-config default khi storage trống/lỗi — graceful degradation, không throw.
 */

const SYNC_KEYS: ReadonlySet<StorageKey> = new Set<StorageKey>(['settings.sync_preferences']);

const DEFAULTS: Readonly<Partial<Record<StorageKey, unknown>>> = {
  'settings.telemetry_enabled': true,
  'settings.log_level': buildConfig.logLevel,
};

function isSyncKey(key: StorageKey): boolean {
  return SYNC_KEYS.has(key);
}

function driverFor(key: StorageKey): StorageDriver {
  return isSyncKey(key) ? syncDriver : localDriver;
}

export async function getSetting<K extends StorageKey>(
  key: K,
): Promise<Result<StorageValue<K> | undefined>> {
  try {
    const result = await driverFor(key).get(key);
    if (result.ok && result.data !== undefined) {
      return { ok: true, data: result.data };
    }
  } catch {
    // fallback default khi storage lỗi — graceful degradation, không throw
  }
  return { ok: true, data: DEFAULTS[key] as StorageValue<K> | undefined };
}

export async function setSetting(key: StorageKey, value: unknown): Promise<Result<void>> {
  return driverFor(key).set({ [key]: value });
}

export function subscribe(callback: (changes: StorageChangeMap) => void): () => void {
  const listener = (
    changes: { [key: string]: Browser.storage.StorageChange },
    areaName: Browser.storage.AreaName,
  ): void => {
    if (areaName === 'local' || areaName === 'sync') callback(changes);
  };
  browser.storage.onChanged.addListener(listener);
  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
