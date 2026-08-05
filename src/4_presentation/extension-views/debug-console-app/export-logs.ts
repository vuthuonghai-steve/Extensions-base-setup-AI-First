import type { LogEntry } from '@contracts/log-schema';

/**
 * Export log JSON (OBS-3 — D9 Phase 5). KHÔNG gọi console (OBS-1):
 * Blob URL + createObjectURL → download, không in ra DevTools.
 */
export function downloadLogsJson(entries: LogEntry[], fileName = 'logs.json'): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
