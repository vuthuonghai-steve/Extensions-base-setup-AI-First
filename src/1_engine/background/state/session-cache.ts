import { type StorageKey } from '@contracts/storage-schema';
import { sessionDriver } from '@platform/storage/session-driver';

/**
 * Session cache cho Service Worker (Architect §2, §4 — State Persistence Layer).
 * Đệm state SW vào chrome.storage.session trước khi SW bị idle-kill (~30s),
 * rehydrate khi SW thức dậy. CACHE TẠM — nguồn sự thật là chrome.storage.local.
 */
export async function saveSessionState(
  values: Partial<Record<StorageKey, unknown>>,
): Promise<void> {
  const result = await sessionDriver.set(values);
  if (!result.ok) {
    // Session cache lỗi không được phép crash SW — state vẫn ở local (nguồn sự thật).
    return;
  }
}

export async function loadSessionState<K extends StorageKey>(
  keys: K[],
): Promise<Partial<Record<K, unknown>>> {
  const result = await sessionDriver.getMany(keys);
  if (!result.ok) return {};
  return result.data;
}
