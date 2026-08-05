import { describe, expect, it } from 'vitest';
import { DONE_SENTINEL, decodeSseChunk } from '@modules/sub-modules/ai-stream-decoder/index';

describe('ai-stream-decoder', () => {
  it('decodeSseChunk: data lines hợp lệ → chunks JSON, done=false', () => {
    const result = decodeSseChunk('data: {"a":1}\ndata: {"b":2}\n');
    expect(result).toEqual({ chunks: [{ a: 1 }, { b: 2 }], done: false, skipped: 0 });
  });

  it('decodeSseChunk: [DONE] → done=true', () => {
    const result = decodeSseChunk(`data: {"a":1}\ndata: ${DONE_SENTINEL}\n`);
    expect(result.done).toBe(true);
    expect(result.chunks).toEqual([{ a: 1 }]);
  });

  it('decodeSseChunk: bỏ qua line không phải data: và comment', () => {
    const result = decodeSseChunk('event: ping\n: comment\ndata: {"a":1}\n');
    expect(result.chunks).toEqual([{ a: 1 }]);
  });

  it('decodeSseChunk: malformed JSON → skip + đếm', () => {
    const result = decodeSseChunk('data: not-json\ndata: {"ok":true}\n');
    expect(result).toEqual({ chunks: [{ ok: true }], done: false, skipped: 1 });
  });
});
