import { describe, expect, it } from 'vitest';
import {
  BookmarkError,
  deleteBookmark,
  normalizeUrl,
  saveBookmark,
} from '@modules/composite-modules/bookmark-manager/use-cases/bookmark-actions';
import type {
  Bookmark,
  BookmarkResult,
  BookmarkStore,
} from '@modules/composite-modules/bookmark-manager/index';

const NOW = '2026-08-06T12:00:00.000Z';

/** In-memory store đóng vai adapter Layer 2 — lắp thật ở Phase 5. */
function createMemoryStore(initial: Bookmark[] = []): BookmarkStore {
  let items = [...initial];
  return {
    list(): Promise<BookmarkResult<Bookmark[]>> {
      return Promise.resolve({ ok: true, data: [...items] });
    },
    save(bookmark: Bookmark): Promise<BookmarkResult<Bookmark>> {
      items = [...items, bookmark];
      return Promise.resolve({ ok: true, data: bookmark });
    },
    remove(id: string): Promise<BookmarkResult<void>> {
      items = items.filter((b) => b.id !== id);
      return Promise.resolve({ ok: true, data: undefined });
    },
  };
}

describe('bookmark-manager — saveBookmark', () => {
  it('lưu bookmark mới → ok + trả bookmark đã normalize', async () => {
    const store = createMemoryStore();
    const result = await saveBookmark(
      store,
      { url: 'https://Example.com/Post/', title: 'Post' },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'https://example.com/Post',
        url: 'https://example.com/Post',
        title: 'Post',
        createdAt: NOW,
      },
    });
  });

  it('URL trùng (đã normalize) → err Duplicate, không ghi', async () => {
    const store = createMemoryStore([
      {
        id: 'https://example.com/Post',
        url: 'https://example.com/Post',
        title: 'Cũ',
        createdAt: NOW,
      },
    ]);
    const result = await saveBookmark(
      store,
      { url: 'https://EXAMPLE.com/Post', title: 'Mới' },
      NOW,
    );
    expect(result).toEqual({ ok: false, error: BookmarkError.Duplicate });
  });

  it('URL không hợp lệ → err InvalidUrl', async () => {
    const store = createMemoryStore();
    const result = await saveBookmark(store, { url: 'not-a-url', title: 'x' }, NOW);
    expect(result).toEqual({ ok: false, error: BookmarkError.InvalidUrl });
  });

  it('store.list fail → err StoreFailure, không throw', async () => {
    const store: BookmarkStore = {
      list(): Promise<BookmarkResult<Bookmark[]>> {
        return Promise.resolve({ ok: false, error: 'boom' });
      },
      save(b) {
        return Promise.resolve({ ok: true, data: b });
      },
      remove() {
        return Promise.resolve({ ok: true, data: undefined });
      },
    };
    const result = await saveBookmark(store, { url: 'https://example.com/a', title: 'a' }, NOW);
    expect(result).toEqual({ ok: false, error: BookmarkError.StoreFailure });
  });
});

describe('bookmark-manager — deleteBookmark', () => {
  it('xóa bookmark tồn tại → ok', async () => {
    const store = createMemoryStore([
      {
        id: 'https://example.com/Post',
        url: 'https://example.com/Post',
        title: 'Cũ',
        createdAt: NOW,
      },
    ]);
    const result = await deleteBookmark(store, 'https://Example.com/Post/');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('xóa bookmark không tồn tại → err NotFound', async () => {
    const store = createMemoryStore();
    const result = await deleteBookmark(store, 'https://example.com/missing');
    expect(result).toEqual({ ok: false, error: BookmarkError.NotFound });
  });

  it('xóa với URL không hợp lệ → err InvalidUrl', async () => {
    const store = createMemoryStore();
    const result = await deleteBookmark(store, ':::');
    expect(result).toEqual({ ok: false, error: BookmarkError.InvalidUrl });
  });
});

describe('bookmark-manager — normalizeUrl', () => {
  it('chuẩn hóa host/hash/trailing slash (path giữ case — URL chuẩn)', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Post/#section')).toBe('https://example.com/Post');
  });

  it('không phải http/https → null', () => {
    expect(normalizeUrl('ftp://example.com/file')).toBeNull();
  });

  it('chuỗi rỗng → null', () => {
    expect(normalizeUrl('  ')).toBeNull();
  });
});
