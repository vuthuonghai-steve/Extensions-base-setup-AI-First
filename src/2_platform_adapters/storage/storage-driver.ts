import { AppErrorCode, type AppError } from '@contracts/ipc-payloads';
import {
  type StorageArea,
  type StorageKey,
  type StorageLocalSchema,
  type StorageSessionSchema,
  type StorageSyncSchema,
} from '@contracts/storage-schema';
import { browser, type Browser } from 'wxt/browser';

/**
 * Standard application result envelope — Ok/Err, không throw (Architect §11, code-quality §3).
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

/**
 * Type map: StorageKey → value type theo schema của đúng area (storage-schema.ts — Layer 0).
 */
export type StorageValue<K extends StorageKey> = K extends keyof StorageSessionSchema
  ? StorageSessionSchema[K]
  : K extends keyof StorageLocalSchema
    ? StorageLocalSchema[K]
    : K extends keyof StorageSyncSchema
      ? StorageSyncSchema[K]
      : never;

/** Shape của browser.storage.onChanged changes — newValue/oldValue đều optional (StorageChange). */
export type StorageChangeMap = Record<string, { newValue?: unknown; oldValue?: unknown }>;

/** Giới hạn key mỗi lần set (storage rule §8 — ≤60 key/lần, event onChanged). */
const MAX_KEYS_PER_SET = 60;

/**
 * Interface chung cho 3 storage drivers (Architect §4) — bọc browser.storage 1-1.
 */
export interface StorageDriver {
  get<K extends StorageKey>(key: K): Promise<Result<StorageValue<K> | undefined>>;
  getMany<K extends StorageKey>(keys: K[]): Promise<Result<Record<K, StorageValue<K> | undefined>>>;
  set(values: Partial<Record<StorageKey, unknown>>): Promise<Result<void>>;
  remove(keys: StorageKey[]): Promise<Result<void>>;
  getBytesInUse(): Promise<Result<number>>;
  subscribe(callback: (changes: StorageChangeMap) => void): () => void;
}

/**
 * Factory tạo instance per-area (local/session/sync).
 * Mọi operation catch lỗi → AppError(STORAGE_ERROR), KHÔNG bao giờ throw (graceful degradation).
 * getMany/set gom 1 lần gọi storage (batch — storage rule §8), set tối đa 60 key.
 */
export function createStorageDriver(area: StorageArea): StorageDriver {
  const storageArea = browser.storage[area];

  const run = async <T>(op: string, fn: () => Promise<T>): Promise<Result<T>> => {
    try {
      return { ok: true, data: await fn() };
    } catch (cause) {
      return {
        ok: false,
        error: {
          code: AppErrorCode.STORAGE_ERROR,
          message: `storage.${area}.${op} failed`,
          detail: cause,
        },
      };
    }
  };

  return {
    async get(key) {
      return run('get', async () => {
        const result = await storageArea.get<Record<string, unknown>>(key);
        return result[key] as StorageValue<typeof key> | undefined;
      });
    },

    async getMany(keys) {
      return run('get', async () => {
        const result = await storageArea.get<Record<string, unknown>>(keys);
        return result as Record<
          (typeof keys)[number],
          StorageValue<(typeof keys)[number]> | undefined
        >;
      });
    },

    async set(values) {
      if (Object.keys(values).length > MAX_KEYS_PER_SET) {
        return {
          ok: false,
          error: {
            code: AppErrorCode.STORAGE_ERROR,
            message: `storage.${area}.set failed: vượt ${MAX_KEYS_PER_SET} key/lần`,
            detail: { keys: Object.keys(values).length },
          },
        };
      }
      return run('set', async () => {
        await storageArea.set(values);
      });
    },

    async remove(keys) {
      return run('remove', async () => {
        await storageArea.remove<Record<string, unknown>>(keys);
      });
    },

    async getBytesInUse() {
      return run('getBytesInUse', async () =>
        storageArea.getBytesInUse<Record<string, unknown>>(null),
      );
    },

    subscribe(callback) {
      const listener = (
        changes: { [key: string]: Browser.storage.StorageChange },
        areaName: Browser.storage.AreaName,
      ): void => {
        if (areaName === area) callback(changes);
      };
      browser.storage.onChanged.addListener(listener);
      return () => {
        browser.storage.onChanged.removeListener(listener);
      };
    },
  };
}
