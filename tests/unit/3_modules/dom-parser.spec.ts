import { describe, expect, it } from 'vitest';
import { parsePageMetadata } from '@modules/sub-modules/dom-parser/index';

const SAMPLE_HTML =
  '<html><head>' +
  '<title>My &amp; Page</title>' +
  '<link rel="canonical" href="https://example.com/post">' +
  '</head><body><p>Hello world</p></body></html>';

describe('dom-parser', () => {
  it('parsePageMetadata: HTML hợp lệ → title/url/textLength', () => {
    const result = parsePageMetadata(SAMPLE_HTML);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('My & Page');
      expect(result.data.url).toBe('https://example.com/post');
      expect(result.data.textLength).toBeGreaterThan(0);
    }
  });

  it('parsePageMetadata: fallbackUrl dùng khi thiếu canonical', () => {
    const html = '<html><head><title>No Canonical</title></head></html>';
    const result = parsePageMetadata(html, 'https://fallback.example');
    expect(result).toEqual({
      ok: true,
      data: { title: 'No Canonical', url: 'https://fallback.example', textLength: 18 },
    });
  });

  it('parsePageMetadata: HTML rỗng → err, không throw', () => {
    const result = parsePageMetadata('');
    expect(result).toEqual({ ok: false, error: 'empty html input' });
  });

  it('parsePageMetadata: thiếu title và fallbackUrl rỗng → err', () => {
    const result = parsePageMetadata('<html><body>nothing</body></html>');
    expect(result.ok).toBe(false);
  });
});
