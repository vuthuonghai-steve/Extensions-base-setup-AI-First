import { useCallback, useEffect, useState } from 'react';
import { IpcAction } from '@contracts/ipc-actions';
import type { StorageArea } from '@contracts/storage-schema';
import { sendMessage } from '@platform/ipc/sender';

/**
 * StorageInspector (OBS-3 — D9 Phase 5): gọi IPC StorageInspect để soi
 * chrome.storage theo area (local/session/sync).
 */
const AREAS: StorageArea[] = ['local', 'session', 'sync'];

export function StorageInspector(): React.JSX.Element {
  const [area, setArea] = useState<StorageArea>('local');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((): void => {
    void sendMessage(IpcAction.StorageInspect, { area }).then((response) => {
      if (response.ok === true) {
        setData(response.data.data);
        setError(null);
      } else {
        setError(response.error.message);
      }
    });
  }, [area]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={area} onChange={(event) => setArea(event.target.value as StorageArea)}>
          {AREAS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
      {error !== null && <p style={{ color: '#c00' }}>{error}</p>}
      <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
