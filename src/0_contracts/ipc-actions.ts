/**
 * Layer 0 — tên toàn bộ action message IPC (ADR-002: nguồn sự thật duy nhất).
 * Chỉ thêm action khi có handler thật (quy trình 5 bước — Architect-workspace.md §12).
 */
export enum IpcAction {
  /** Telemetry: context gửi log về Background Log Sink (ADR-003). */
  LogSink = 'telemetry.log.sink',
  /** Config runtime: đọc settings người dùng (runtime-config-adapter). */
  SettingsGet = 'settings.get',
  /** Config runtime: ghi settings người dùng (runtime-config-adapter). */
  SettingsSet = 'settings.set',
  /** Debug Console (OBS-3): soi chrome.storage session/local/sync. */
  StorageInspect = 'debug.storage.inspect',
}
