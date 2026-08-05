import type { MessageResponse } from '@contracts/ipc-payloads';
import { IpcAction } from '@contracts/ipc-actions';
import type { StorageArea, StorageKey } from '@contracts/storage-schema';
import { handleLogSinkEntry } from '../telemetry/log-sink';
import { LogRingBuffer } from '../telemetry/log-ring-buffer';
import { broadcastLogEntry } from '../telemetry/log-broadcaster';
import { createStorageDriver } from '../storage/storage-driver';
import { sessionDriver } from '../storage/session-driver';
import { getSetting, setSetting } from '../config/runtime-config-adapter';
import type { Router } from './router';

/** Ring buffer log — instance duy nhất cho toàn bộ session (D5). */
const logBuffer = new LogRingBuffer(sessionDriver);

/** Keys storage theo area (storage-schema — Layer 0 nguồn sự thật duy nhất). */
const AREA_KEYS: Record<StorageArea, StorageKey[]> = {
  local: [
    'settings.theme',
    'settings.telemetry_enabled',
    'settings.log_level',
    'settings.sync_preferences',
  ],
  session: ['telemetry.logs.buffer', 'telemetry.logs.head', 'session.sw_active_timestamp'],
  sync: ['settings.sync_preferences'],
};

/**
 * Đăng ký 4 handler hạ tầng (D10) — engine Phase 5 chỉ gọi 1 lần tại bootstrap.
 * - LogSink: validate + persist qua log-sink, broadcast bản đã sanitize.
 * - SettingsGet/Set: runtime config (storage) — không throw, Result → envelope.
 * - StorageInspect: đọc toàn bộ storage theo area (OBS-3 Debug Console).
 */
export function registerInfrastructureHandlers(router: Router): void {
  router.registerHandler(IpcAction.LogSink, async (request) => {
    const result = await handleLogSinkEntry(request.entry, logBuffer);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    // Broadcast bản ĐÃ SANITIZE — entry từ log-sink persist là nguồn sự thật (D9).
    broadcastLogEntry(request.entry);
    return { ok: true, data: { acknowledged: true } };
  });

  router.registerHandler(IpcAction.SettingsGet, async (request) => {
    if (request.key === undefined) {
      return { ok: true, data: { value: undefined } };
    }
    const result = await getSetting(request.key);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: { value: result.data } };
  });

  router.registerHandler(IpcAction.SettingsSet, async (request) => {
    const result = await setSetting(request.key, request.value);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: undefined };
  });

  router.registerHandler(IpcAction.StorageInspect, async (request) => {
    if (request.area === undefined) {
      return inspectAllAreas();
    }
    return inspectArea(request.area);
  });
}

async function inspectArea(
  area: StorageArea,
): Promise<MessageResponse<{ data: Record<string, unknown> }>> {
  const driver = createStorageDriver(area);
  const result = await driver.getMany(AREA_KEYS[area]);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, data: { data: result.data } };
}

async function inspectAllAreas(): Promise<MessageResponse<{ data: Record<string, unknown> }>> {
  const entries = await Promise.all([
    inspectArea('local'),
    inspectArea('session'),
    inspectArea('sync'),
  ]);
  const data: Record<string, unknown> = {};
  for (const [area, entry] of [
    ['local', entries[0]],
    ['session', entries[1]],
    ['sync', entries[2]],
  ] as const) {
    if (entry.ok) {
      data[area] = entry.data.data;
    }
  }
  return { ok: true, data: { data } };
}
