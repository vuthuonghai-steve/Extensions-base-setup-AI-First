/**
 * Page context hook (Architect §4) — Main World: thấy DOM + biến JS global
 * của trang, KHÔNG có chrome.*. Mọi liên lạc ngược ra Isolated World qua
 * main-world-bridge.ts. Stub — feature thật nối vào Phase 6.
 */

/** Đọc biến global của trang theo tên — undefined nếu không có. */
export function readPageGlobal<T>(name: string): T | undefined {
  const value = (globalThis as Record<string, unknown>)[name];
  return value as T | undefined;
}
