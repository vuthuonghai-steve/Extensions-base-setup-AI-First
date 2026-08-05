/**
 * DOM parse handler (Architect §4 — offscreen, SW mượn khi cần DOM ẩn).
 * Pure function — test trực tiếp, không đụng chrome (D6 Phase 5).
 * Entrypoint offscreen (createDocument url + reasons) nối vào Phase 6.
 */

export interface ParseResult {
  title: string;
  description: string;
  linkCount: number;
}

/** Trích title/description/đếm link từ HTML string (DOM ẩn offscreen). */
export function parseDocument(html: string): ParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return {
    title: doc.title,
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    linkCount: doc.querySelectorAll('a').length,
  };
}
