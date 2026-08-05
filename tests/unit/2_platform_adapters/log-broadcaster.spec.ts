import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Browser } from 'wxt/browser';
import { LogLevel, type LogEntry } from '@contracts/log-schema';

// fake-browser KHÔNG mock runtime.onConnect — spy phải đặt TRƯỚC khi import
// log-broadcaster (module load đăng ký listener). Module chỉ import 1 lần.
const spies: Array<(port: Browser.runtime.Port) => void> = [];
const addSpy = vi.spyOn(fakeBrowser.runtime.onConnect, 'addListener');
addSpy.mockImplementation((listener) => {
  spies.push(listener);
});
const { broadcastLogEntry, portName } =
  await import('../../../src/2_platform_adapters/telemetry/log-broadcaster');
const emit = (port: Browser.runtime.Port) => {
  for (const listener of spies) listener(port);
};

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  trace_id: 'trace-1',
  scope: 'test',
  level: LogLevel.INFO,
  file_line: 'src/test.ts:1',
  decision_reason: 'test entry',
  payload: {},
  timestamp: '2026-08-05T00:00:00.000Z',
  ...overrides,
});

function makePort(name: string): Browser.runtime.Port {
  return {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() } as never,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() } as never,
  };
}

describe('log-broadcaster', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('broadcast entry tới port đúng tên, không gửi tới port khác tên', () => {
    const matching = makePort(portName);
    const other = makePort('other.channel');
    emit(matching);
    emit(other);

    broadcastLogEntry(makeEntry());

    expect(matching.postMessage).toHaveBeenCalledWith({
      type: 'log-entry',
      entry: makeEntry(),
    });
    expect(other.postMessage).not.toHaveBeenCalled();
  });

  it('no-op khi không có port nào kết nối (không throw)', () => {
    expect(() => broadcastLogEntry(makeEntry())).not.toThrow();
  });

  it('disconnect prune port — broadcast sau đó không gửi tới port đã đóng', () => {
    const port = makePort(portName);
    emit(port);

    // Giả lập disconnect: chạy listener onDisconnect (đã đăng ký lúc connect).
    const addSpy = vi.spyOn(port.onDisconnect, 'addListener');
    const registered = addSpy.mock.calls[0]?.[0];
    expect(registered).toBeTypeOf('function');
    if (registered) registered(port);

    broadcastLogEntry(makeEntry());
    expect(port.postMessage).not.toHaveBeenCalled();
  });
});
