import type { LogEntry } from '@contracts/log-schema';
import { onPortConnect } from '../ipc/port-channel';

/**
 * Tên port dùng chung cho luồng broadcast log tới Debug Console (OBS-3).
 * Export để port-channel agent và Phase 5 Debug Console dùng lại đúng tên.
 */
export const portName = 'telemetry.broadcast';

/** Payload gửi qua port tới mỗi listener đang theo dõi log (OBS-3). */
export interface BroadcastMessage {
  type: 'log-entry';
  entry: LogEntry;
}

/** Tập port đang kết nối — plain Set; port tự prune khi onDisconnect. */
const ports = new Set<Browser.runtime.Port>();

// Subscribe MỘT LẦN tại module load (hạ tầng Layer 2, không phải business
// logic engine — D2). onPortConnect tự filter đúng portName.
onPortConnect(portName, (port) => {
  ports.add(port);
  port.onDisconnect.addListener(() => {
    ports.delete(port);
  });
});

/**
 * Broadcast một log entry (đã sanitize bởi log-sink) tới mọi port đang
 * kết nối với đúng `portName`. No throw — postMessage lỗi (port đã chết)
 * thì bỏ qua port đó. Không có port → no-op.
 */
export function broadcastLogEntry(entry: LogEntry): void {
  if (ports.size === 0) return;
  const message: BroadcastMessage = { type: 'log-entry', entry };
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      // Port đã đóng giữa chừng — prune rồi bỏ qua, không throw (D2).
      ports.delete(port);
    }
  }
}
