import { useState } from 'react';
import type { LogEntry } from '@contracts/log-schema';
import { LogViewer } from './LogViewer';
import { StorageInspector } from './StorageInspector';
import { downloadLogsJson } from './export-logs';

/**
 * Debug Console cockpit (OBS-3 — D9 Phase 5). LogViewer giữ entries nội bộ;
 * export gom từ chính danh sách đã nhận — không console (OBS-1).
 */
export function DebugConsoleApp(): React.JSX.Element {
  const [exportEntries, setExportEntries] = useState<LogEntry[]>([]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Debug Console</h1>

      <LogViewer onEntriesChange={setExportEntries} />

      <button
        type="button"
        onClick={() => {
          downloadLogsJson(exportEntries);
        }}
        style={{ marginTop: 8 }}
      >
        Export log JSON ({exportEntries.length})
      </button>

      <h2 style={{ fontSize: 14, margin: '16px 0 8px' }}>Storage Inspector</h2>
      <StorageInspector />
    </div>
  );
}
