import { useCallback, useEffect, useState } from 'react';
import { IpcAction } from '@contracts/ipc-actions';
import type { StorageKey } from '@contracts/storage-schema';
import { sendMessage } from '@platform/ipc/sender';

/**
 * Popup = settings showcase (ADR-007 — view thuần, D8 Phase 5).
 * React state CHỈ mirror storage: mount → fetch SettingsGet, toggle → SettingsSet.
 * Popup chết khi mất focus — mỗi lần mở fetch lại từ storage.
 */

interface SettingsState {
  theme: string;
  telemetry_enabled: boolean;
  log_level: string;
}

const INITIAL: SettingsState = {
  theme: 'system',
  telemetry_enabled: true,
  log_level: 'INFO',
};

const KEYS: { key: StorageKey; field: keyof SettingsState }[] = [
  { key: 'settings.theme', field: 'theme' },
  { key: 'settings.telemetry_enabled', field: 'telemetry_enabled' },
  { key: 'settings.log_level', field: 'log_level' },
];

export function PopupApp(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsState>(INITIAL);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((): void => {
    const load = async (): Promise<void> => {
      const next = { ...INITIAL };
      let failed = false;
      for (const { key, field } of KEYS) {
        const response = await sendMessage(IpcAction.SettingsGet, { key });
        if (response?.ok !== true) {
          failed = true;
          continue;
        }
        const value = response.data.value;
        switch (field) {
          case 'theme':
            next.theme = typeof value === 'string' ? value : next.theme;
            break;
          case 'telemetry_enabled':
            next.telemetry_enabled = typeof value === 'boolean' ? value : next.telemetry_enabled;
            break;
          case 'log_level':
            next.log_level = typeof value === 'string' ? value : next.log_level;
            break;
        }
      }
      setSettings(next);
      setError(failed ? 'Một số settings không đọc được (SW chưa sẵn sàng).' : null);
    };
    void load();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = (key: StorageKey, value: boolean): void => {
    void sendMessage(IpcAction.SettingsSet, { key, value }).then((response) => {
      if (response.ok === true) {
        setSettings((prev) => ({ ...prev, [key]: value }));
      } else {
        setError('Ghi setting thất bại — SW chưa sẵn sàng.');
      }
    });
  };

  const openDebugConsole = (): void => {
    void browser.tabs.create({ url: browser.runtime.getURL('/debug-console.html') });
  };

  return (
    <div style={{ width: 280, padding: 12, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 16, margin: '0 0 12px' }}>Settings</h1>

      <label style={{ display: 'block', marginBottom: 8 }}>
        Theme
        <select
          value={settings.theme}
          onChange={(event) => {
            void sendMessage(IpcAction.SettingsSet, {
              key: 'settings.theme',
              value: event.target.value,
            });
          }}
          style={{ marginLeft: 8 }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={settings.telemetry_enabled}
          onChange={(event) => {
            void toggle('settings.telemetry_enabled', event.target.checked);
          }}
        />{' '}
        Telemetry enabled
      </label>

      <label style={{ display: 'block', marginBottom: 12 }}>
        Log level
        <select
          value={settings.log_level}
          onChange={(event) => {
            void sendMessage(IpcAction.SettingsSet, {
              key: 'settings.log_level',
              value: event.target.value,
            });
          }}
          style={{ marginLeft: 8 }}
        >
          <option value="DEBUG">DEBUG</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
      </label>

      <button type="button" onClick={openDebugConsole}>
        Open Debug Console
      </button>

      {error !== null && <p style={{ color: '#c00', marginTop: 8 }}>{error}</p>}
    </div>
  );
}
