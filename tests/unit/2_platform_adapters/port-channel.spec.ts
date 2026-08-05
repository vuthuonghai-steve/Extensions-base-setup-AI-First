import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Browser } from 'wxt/browser';
import { onPortConnect, openPort } from '@platform/ipc/port-channel';

type PortListener = (port: Browser.runtime.Port) => void;

function makePort(name: string): Browser.runtime.Port {
  return {
    name,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() } as never,
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() } as never,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
  };
}

function captureConnectListener(): {
  emit: (port: Browser.runtime.Port) => void;
  removed: () => boolean;
} {
  const spies: PortListener[] = [];
  const addSpy = vi.spyOn(fakeBrowser.runtime.onConnect, 'addListener');
  const removeSpy = vi.spyOn(fakeBrowser.runtime.onConnect, 'removeListener');
  addSpy.mockImplementation((listener) => {
    spies.push(listener);
  });
  removeSpy.mockImplementation(() => {
    spies.length = 0;
  });
  return {
    emit: (port: Browser.runtime.Port) => {
      // emit cho MỌI listener đã đăng ký — mỗi listener tự filter theo name
      for (const listener of spies) listener(port);
    },
    removed: () => spies.length === 0,
  };
}

describe('openPort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connect được gọi với đúng name', () => {
    const connectSpy = vi
      .spyOn(fakeBrowser.runtime, 'connect')
      .mockReturnValue(makePort('log-stream'));
    const channel = openPort('log-stream');
    expect(connectSpy).toHaveBeenCalledWith({ name: 'log-stream' });
    expect(channel.port.name).toBe('log-stream');
    channel.close();
  });

  it('send gửi dữ liệu qua port.postMessage', () => {
    const port = makePort('log-stream');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(port);
    const channel = openPort('log-stream');
    const postSpy = vi.spyOn(port, 'postMessage');
    channel.send({ level: 'INFO', text: 'hello' });
    expect(postSpy).toHaveBeenCalledWith({ level: 'INFO', text: 'hello' });
    channel.close();
  });

  it('close gọi disconnect; send sau close không throw', () => {
    const port = makePort('log-stream');
    vi.spyOn(fakeBrowser.runtime, 'connect').mockReturnValue(port);
    const channel = openPort('log-stream');
    const disconnectSpy = vi.spyOn(port, 'disconnect');
    channel.close();
    expect(disconnectSpy).toHaveBeenCalled();
    expect(() => channel.send({ x: 1 })).not.toThrow();
  });
});

describe('onPortConnect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filter theo port.name — chỉ handler đúng name được gọi', () => {
    const handler = vi.fn();
    const { emit } = captureConnectListener();
    onPortConnect('log-stream', handler);
    const other = vi.fn();
    onPortConnect('other-stream', other);

    emit(makePort('log-stream'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();

    emit(makePort('other-stream'));
    expect(other).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe gỡ listener — không còn nhận sự kiện', () => {
    const handler = vi.fn();
    const { removed, emit } = captureConnectListener();
    const unsubscribe = onPortConnect('log-stream', handler);
    expect(removed()).toBe(false);
    unsubscribe();
    expect(removed()).toBe(true);
    emit(makePort('log-stream'));
    expect(handler).not.toHaveBeenCalled();
  });
});
