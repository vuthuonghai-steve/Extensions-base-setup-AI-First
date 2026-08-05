import { createStorageDriver, type StorageDriver } from './storage-driver';

/**
 * Driver bền vững cho chrome.storage.local — nguồn sự thật (storage rule §2).
 */
export const localDriver: StorageDriver = createStorageDriver('local');
