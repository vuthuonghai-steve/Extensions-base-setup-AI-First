/**
 * DOM bridge (Architect §4) — Isolated World đọc/ghi DOM trang đích.
 * KHÔNG gửi message qua bridge (chỉ Main World mới cần) —
 * entrypoint content (matches thật) sẽ nối vào ở Phase 6.
 */

/** Lấy text content của selector đầu tiên khớp — null nếu không có. */
export function queryText(selector: string): string | null {
  return document.querySelector(selector)?.textContent ?? null;
}

/** Inject một button tạm (Phase 6 thay bằng mount-point Shadow DOM). */
export function injectDebugButton(label: string): void {
  const button = document.createElement('button');
  button.textContent = label;
  button.id = 'wxt-debug-button';
  document.body.append(button);
}
