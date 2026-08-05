import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  chromium,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import type { LogEntry } from '@contracts/log-schema';

/**
 * Fixture extension thật (testing-and-verification.md §2 — launchPersistentContext
 * BẮT BUỘC, không launch()+newContext()). Build extension trước khi chạy:
 * `pnpm build` → `.output/chrome-mv3`.
 */

const EXTENSION_PATH = resolve('.output/chrome-mv3');

/** Khởi tạo context chung cho toàn bộ test — extension MV3 không load được
 *  qua launch()+newContext(), phải launchPersistentContext với userDataDir. */
let sharedContext: BrowserContext | null = null;
let userDataDir: string | null = null;

export async function launchExtensionContext(): Promise<BrowserContext> {
  if (sharedContext !== null) return sharedContext;
  userDataDir = mkdtempSync(join(tmpdir(), 'wxt-e2e-'));
  sharedContext = await chromium.launchPersistentContext(userDataDir, {
    // channel: 'chromium' — headless shell mặc định KHÔNG hỗ trợ extension
    // (SW background.js không bao giờ khởi động). Chrome mới headless = full.
    channel: 'chromium',
    headless: true,
    // --load-extension yêu cầu --disable-extensions-except (Chrome yêu cầu cả hai)
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
  return sharedContext;
}

/** Dọn context + profile tạm sau mỗi test — userDataDir không để dính state. */
export async function closeExtensionContext(): Promise<void> {
  if (sharedContext !== null) {
    await sharedContext.close();
    sharedContext = null;
  }
  if (userDataDir !== null) {
    rmSync(userDataDir, { recursive: true, force: true });
    userDataDir = null;
  }
}

/** Lấy Background Service Worker handle — đợi tới khi có (SW khởi động async). */
export async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  const [worker] = context.serviceWorkers();
  if (worker !== undefined && worker.url().endsWith('background.js')) return worker;
  // SW có thể chưa kịp khởi động — đợi event (timeout 10s).
  const timeoutMs = 10_000;
  return new Promise<Worker>((resolveWorker, reject) => {
    const timer = setTimeout(() => {
      context.off('serviceworker', onWorker);
      reject(new Error('getServiceWorker timeout — extension không load (build chưa chạy?)'));
    }, timeoutMs);
    const onWorker = (w: Worker): void => {
      if (w.url().endsWith('background.js')) {
        clearTimeout(timer);
        context.off('serviceworker', onWorker);
        resolveWorker(w);
      }
    };
    context.on('serviceworker', onWorker);
  });
}

/** Extension ID runtime — lấy từ SW handle, không hardcode (manifest không có "key"). */
export async function extensionUrl(context: BrowserContext, path: string): Promise<string> {
  const sw = await getServiceWorker(context);
  const id = await sw.evaluate(() => chrome.runtime.id);
  return `chrome-extension://${id}/${path}`;
}

/**
 * Emit log từ "client context" giả lập (như Popup/Content) — gửi qua IPC LogSink
 * từ extension page (SW handle evaluate bị Chrome kill giữa chừng → dùng page
 * đáng tin hơn). traceId do caller truyền (OBS-2: bắt buộc, không optional).
 */
export async function emitLog(
  page: Page,
  entry: Omit<LogEntry, 'trace_id' | 'timestamp'> & { trace_id?: string; timestamp?: string },
): Promise<void> {
  const traceId = entry.trace_id ?? 'e2e-trace';
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const payload: LogEntry = {
    trace_id: traceId,
    scope: entry.scope,
    level: entry.level,
    file_line: entry.file_line,
    decision_reason: entry.decision_reason,
    payload: entry.payload ?? {},
    timestamp,
  };
  await page.evaluate(
    ({ tid, entry: payloadEntry }) =>
      chrome.runtime.sendMessage({
        action: 'telemetry.log.sink',
        traceId: tid,
        entry: payloadEntry,
      }),
    { tid: traceId, entry: payload },
  );
}

/** Đọc storage session qua IPC StorageInspect (ring buffer + sw_active_timestamp). */
export async function inspectStorage(
  page: Page,
  area: 'local' | 'session' | 'sync' = 'session',
): Promise<Record<string, unknown>> {
  const response = await page.evaluate(
    (request: { action: string; traceId: string; area: string }) =>
      chrome.runtime.sendMessage(request) as Promise<{
        ok: boolean;
        data?: { data: Record<string, unknown> };
      }>,
    { action: 'debug.storage.inspect', traceId: 'e2e-inspect', area },
  );
  if (response?.ok !== true) throw new Error('StorageInspect failed');
  return response.data?.data ?? {};
}

/**
 * Chờ tới khi entry có traceId xuất hiện trong ring buffer session storage
 * (batch-window 100ms — log-sink flush delay). Poll StorageInspect mỗi 200ms.
 */
export async function waitForEntry(
  page: Page,
  traceId: string,
  timeoutMs = 10_000,
): Promise<LogEntry> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    const data = await inspectStorage(page, 'session');
    const buffer = (data['telemetry.logs.buffer'] ?? []) as LogEntry[];
    const match = buffer.find((e) => e.trace_id === traceId);
    if (match !== undefined) return match;
    last = `buffer=${buffer.length} entries`;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `waitForEntry timeout ${timeoutMs}ms (${last}) — traceId ${traceId} không xuất hiện`,
  );
}

/** Fixture chính export cho test — context + SW + helpers. */
export const extensionTest = base.extend<{
  context: BrowserContext;
  sw: Worker;
  page: Page;
  openPage: (path: string) => Promise<Page>;
}>({
  context: async ({}, use) => {
    const ctx = await launchExtensionContext();
    await use(ctx);
    await closeExtensionContext();
  },
  sw: async ({ context }, use) => {
    const worker = await getServiceWorker(context);
    await use(worker);
  },
  // Page extension ổn định để gửi IPC (SW handle evaluate bị kill giữa chừng)
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto(await extensionUrl(context, 'popup.html'));
    await use(page);
  },
  openPage: async ({ context }, use) => {
    await use(async (path: string) => {
      const page = await context.newPage();
      await page.goto(await extensionUrl(context, path));
      return page;
    });
  },
});
