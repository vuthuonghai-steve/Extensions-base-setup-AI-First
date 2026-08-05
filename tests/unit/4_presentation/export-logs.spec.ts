// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogLevel, type LogEntry } from '@contracts/log-schema';
import { downloadLogsJson } from '@presentation/extension-views/debug-console-app/export-logs';

const entries: LogEntry[] = [
  {
    trace_id: 't-1',
    scope: 'background',
    level: LogLevel.INFO,
    file_line: 'src/1_engine/background/index.ts:10',
    decision_reason: 'startup',
    payload: {},
    timestamp: '2026-08-06T00:00:00.000Z',
  },
];

describe('export-logs (D9 — Blob JSON download, OBS-1 không console)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tạo Blob JSON chứa đúng LogEntry shape', () => {
    const blobCtor = vi.fn(Blob);
    vi.stubGlobal('Blob', blobCtor);
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:url'), revokeObjectURL: revoke });
    document.body.innerHTML = '<a></a>';
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadLogsJson(entries);

    const blobPart = blobCtor.mock.calls[0]?.[0]?.[0];
    expect(typeof blobPart).toBe('string');
    const parsed = JSON.parse(blobPart as string) as unknown[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      trace_id: 't-1',
      scope: 'background',
      level: 'INFO',
      decision_reason: 'startup',
    });
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:url');
  });
});
