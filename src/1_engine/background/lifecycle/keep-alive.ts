import { browser } from 'wxt/browser';
import { saveSessionState } from '../state/session-cache';

/**
 * Alarm pattern né idle-kill SW (Architect §1, §3 — keep-alive.ts).
 * Chrome MV3 min period cho alarms là 30s → 0.5 phút.
 * Mỗi lần fire: ghi 1 key nhỏ (session.sw_active_timestamp) — 2 writes/phút,
 * xa ngưỡng ~120 writes/phút (storage rule §8).
 */
export const KEEP_ALIVE_ALARM = 'keep-alive';
export const KEEP_ALIVE_PERIOD_MINUTES = 0.5;

export function scheduleKeepAlive(): void {
  void browser.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: KEEP_ALIVE_PERIOD_MINUTES,
  });
}

/** Pure logic — test không cần mock alarms (D13). */
export function heartbeatPayload(nowMs: number): Record<string, number> {
  return { 'session.sw_active_timestamp': nowMs };
}

export async function handleKeepAliveAlarm(): Promise<void> {
  await saveSessionState(heartbeatPayload(Date.now()));
}
