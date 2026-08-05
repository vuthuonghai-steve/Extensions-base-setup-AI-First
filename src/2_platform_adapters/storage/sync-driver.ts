import { createStorageDriver, type StorageDriver } from './storage-driver';

/**
 * Driver cho chrome.storage.sync — preference không nhạy cảm đồng bộ đa thiết bị (storage rule §2).
 */
export const syncDriver: StorageDriver = createStorageDriver('sync');
