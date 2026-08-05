/**
 * Sub-module thuần: format/parse thời gian (Architect §4 — Layer 3 Pure TS).
 * Không import chrome/document/window (G1-06). Invalid input → Result.err, không throw.
 */

export type TimeResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** ISO-8601 UTC → locale string theo Intl; input không parse được → err. */
export function formatDate(iso: string, locale = 'en-US'): TimeResult<string> {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `invalid ISO date: ${iso}` };
  }
  return { ok: true, data: new Intl.DateTimeFormat(locale).format(date) };
}

/** ISO-8601 UTC → relative time (vd "3 hours ago"); tương lai → err (chỉ nhận quá khứ). */
export function formatRelativeTime(iso: string, now: Date = new Date()): TimeResult<string> {
  const date = new Date(iso);
  const nowMs = now.getTime();
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: `invalid ISO date: ${iso}` };
  }
  const diffMs = nowMs - date.getTime();
  if (diffMs < 0) {
    return { ok: false, error: `date is in the future: ${iso}` };
  }
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (minutes < 1) return { ok: true, data: 'just now' };
  if (minutes < 60) return { ok: true, data: rtf.format(-minutes, 'minute') };
  if (hours < 24) return { ok: true, data: rtf.format(-hours, 'hour') };
  return { ok: true, data: rtf.format(-days, 'day') };
}
