import { createStorageDriver, type StorageDriver } from './storage-driver';

/**
 * Driver cho chrome.storage.session — volatile, sống qua SW restart, chết khi browser đóng (storage rule §2).
 */
export const sessionDriver: StorageDriver = createStorageDriver('session');
