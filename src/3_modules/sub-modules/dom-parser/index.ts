/**
 * Sub-module thuần: parse metadata từ HTML string (Architect §4 — Layer 3 Pure TS).
 * KHÔNG đụng DOM API (G1-06) — regex + strip tags trên string thuần; sẵn sàng
 * nhận `outerHTML` trang đẩy xuống từ Content Script (Phase 5).
 */

export interface PageMetadata {
  title: string;
  url: string;
  textLength: number;
}

export type DomParseResult = { ok: true; data: PageMetadata } | { ok: false; error: string };

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const URL_RE = /<link[^>]+rel=["']?canonical["']?[^>]*href=["']([^"']+)["']/i;

/** Trích title/url canonical/độ dài text thuần từ HTML string. */
export function parsePageMetadata(html: string, fallbackUrl = ''): DomParseResult {
  if (typeof html !== 'string' || html.trim() === '') {
    return { ok: false, error: 'empty html input' };
  }
  const titleMatch = html.match(TITLE_RE);
  const urlMatch = html.match(URL_RE);
  const title =
    titleMatch !== null && titleMatch[1] !== undefined
      ? decodeEntities(stripTags(titleMatch[1]).trim())
      : '';
  const url =
    urlMatch !== null && urlMatch[1] !== undefined ? decodeEntities(urlMatch[1]) : fallbackUrl;
  if (title === '' || url === '') {
    return { ok: false, error: 'missing title or canonical url in html' };
  }
  return { ok: true, data: { title, url, textLength: stripTags(html).length } };
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ');
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
