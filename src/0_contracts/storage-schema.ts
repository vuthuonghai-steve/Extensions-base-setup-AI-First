import type { LogEntry, LogLevel } from './log-schema';

/**
 * Storage Area Key Definitions and Type Mappings for chrome.storage.
 * Single source of truth for storage schemas (ADR-002, Storage Rule §7).
 */

/**
 * Session storage schema (Quota budget: ~10MB session storage).
 * Includes telemetry ring buffer and service worker state cache.
 */
export interface StorageSessionSchema {
  'telemetry.logs.buffer': LogEntry[];
  'telemetry.logs.head': number;
  'session.sw_active_timestamp': number;
}

/**
 * Local storage schema (Quota budget: ~10MB local storage).
 * Includes persistent local settings and telemetry configurations.
 */
export interface StorageLocalSchema {
  'settings.theme': 'light' | 'dark' | 'system';
  'settings.telemetry_enabled': boolean;
  'settings.log_level': LogLevel;
}

/**
 * Sync storage schema (Quota budget: ~100KB sync storage).
 * Includes user preferences synchronized across devices.
 */
export interface StorageSyncSchema {
  'settings.sync_preferences': Record<string, unknown>;
}

/**
 * Union of all storage key strings across all areas.
 */
export type StorageKey =
  keyof StorageSessionSchema | keyof StorageLocalSchema | keyof StorageSyncSchema;

/**
 * Storage area names — nguồn sự thật duy nhất cho chrome.storage area literals.
 */
export type StorageArea = 'local' | 'session' | 'sync';
