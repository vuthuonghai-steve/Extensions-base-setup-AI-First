/**
 * Composite module: bookmark-manager (Architect §4 — Layer 3 Pure TS).
 * Storage I/O qua interface `BookmarkStore` do module tự định nghĩa — adapter
 * thật (storage layer 2) lắp ở Phase 5 qua IPC Router (ARC-1 chặn import Layer 2).
 */

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export type BookmarkResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Interface storage tối thiểu — implement bởi adapter ngoài module (Phase 5). */
export interface BookmarkStore {
  list(): Promise<BookmarkResult<Bookmark[]>>;
  save(bookmark: Bookmark): Promise<BookmarkResult<Bookmark>>;
  remove(id: string): Promise<BookmarkResult<void>>;
}
