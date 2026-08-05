import { useEffect, useMemo, useState } from 'react';
import type { LogEntry } from '@contracts/log-schema';
import { openPort } from '@platform/ipc/port-channel';
import { portName, type BroadcastMessage } from '@platform/telemetry/log-broadcaster';
import { MAX_VISIBLE_ENTRIES, type LogFilters, matchesFilters } from './log-filters';

/**
 * LogViewer (OBS-3 — D9 Phase 5): port `telemetry.broadcast` tail real-time,
 * filter scope/level/traceId. Port long-lived qua port-channel.ts.
 * Filter logic tách log-filters.ts (fast-refresh + test thuần).
 */
export interface LogViewerProps {
  /** Nguồn export — nhận toàn bộ entries đã nhận (trước filter). */
  onEntriesChange?: (entries: LogEntry[]) => void;
}

export function LogViewer({ onEntriesChange }: LogViewerProps): React.JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filters, setFilters] = useState<LogFilters>({ scope: '', level: '', traceId: '' });

  useEffect(() => {
    const channel = openPort(portName);
    const onMessage = (message: unknown): void => {
      const data = message as BroadcastMessage | undefined;
      if (data !== undefined && data.type === 'log-entry') {
        setEntries((prev) => [...prev.slice(-MAX_VISIBLE_ENTRIES), data.entry]);
      }
    };
    channel.port.onMessage.addListener(onMessage);
    return () => {
      channel.port.onMessage.removeListener(onMessage);
      channel.close();
    };
  }, []);

  useEffect(() => {
    onEntriesChange?.(entries);
  }, [entries, onEntriesChange]);

  const visible = useMemo(
    () => entries.filter((entry) => matchesFilters(entry, filters)),
    [entries, filters],
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <label>
          Scope
          <input
            value={filters.scope}
            onChange={(event) => setFilters((prev) => ({ ...prev, scope: event.target.value }))}
          />
        </label>
        <label>
          Level
          <select
            value={filters.level}
            onChange={(event) => setFilters((prev) => ({ ...prev, level: event.target.value }))}
          >
            <option value="">All levels</option>
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="FATAL">FATAL</option>
          </select>
        </label>
        <label>
          traceId
          <input
            value={filters.traceId}
            onChange={(event) => setFilters((prev) => ({ ...prev, traceId: event.target.value }))}
          />
        </label>
      </div>

      <pre style={{ maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
        {visible.map((entry) => (
          <div key={`${entry.trace_id}-${entry.timestamp}`}>
            [{entry.level}] [{entry.scope}] {entry.decision_reason}{' '}
            <span style={{ opacity: 0.6 }}>{entry.trace_id}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
