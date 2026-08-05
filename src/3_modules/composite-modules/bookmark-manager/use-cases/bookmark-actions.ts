import type { Bookmark, BookmarkResult, BookmarkStore } from '../index';

const URL_MAX_LENGTH = 2048;

/** Mã lỗi chuẩn cho bookmark-manager (không import từ contracts — Layer 3 độc lập). */
export const BookmarkError = {
  InvalidUrl: 'INVALID_URL',
  Duplicate: 'DUPLICATE',
  NotFound: 'NOT_FOUND',
  StoreFailure: 'STORE_FAILURE',
} as const;

export interface SaveBookmarkInput {
  url: string;
  title: string;
}

/**
 * Use-case: lưu bookmark. Validate URL → check trùng (list từ store, dedupe theo
 * normalized URL) → save. Mọi fail → {ok:false} kèm error code, không throw.
 */
export async function saveBookmark(
  store: BookmarkStore,
  input: SaveBookmarkInput,
  nowIso = new Date().toISOString(),
): Promise<BookmarkResult<Bookmark>> {
  const url = normalizeUrl(input.url);
  if (url === null) {
    return { ok: false, error: BookmarkError.InvalidUrl };
  }
  const listResult = await store.list();
  if (!listResult.ok) return { ok: false, error: BookmarkError.StoreFailure };
  const existing = listResult.data.find((b) => b.url === url);
  if (existing !== undefined) {
    return { ok: false, error: BookmarkError.Duplicate };
  }
  const bookmark: Bookmark = { id: url, url, title: input.title.trim(), createdAt: nowIso };
  const saveResult = await store.save(bookmark);
  if (!saveResult.ok) return { ok: false, error: BookmarkError.StoreFailure };
  return { ok: true, data: bookmark };
}

/**
 * Use-case: xóa bookmark theo URL (id = normalized URL). Không tìm thấy → NOT_FOUND.
 */
export async function deleteBookmark(
  store: BookmarkStore,
  url: string,
): Promise<BookmarkResult<void>> {
  const normalized = normalizeUrl(url);
  if (normalized === null) {
    return { ok: false, error: BookmarkError.InvalidUrl };
  }
  const listResult = await store.list();
  if (!listResult.ok) return { ok: false, error: BookmarkError.StoreFailure };
  if (!listResult.data.some((b) => b.url === normalized)) {
    return { ok: false, error: BookmarkError.NotFound };
  }
  const removeResult = await store.remove(normalized);
  if (!removeResult.ok) return { ok: false, error: BookmarkError.StoreFailure };
  return { ok: true, data: undefined };
}

/**
 * Normalize URL: lowercase scheme/host, bỏ trailing slash, bỏ hash. Không hợp
 * lệnh (thiếu scheme) hoặc quá dài → null.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.length > URL_MAX_LENGTH) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    let normalized = parsed.href;
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return null;
  }
}
