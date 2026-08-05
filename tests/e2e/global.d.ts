/**
 * Chrome global cho E2E (tests/e2e) — Playwright không sinh types chrome,
 * nhưng SW handle + extension page evaluate dùng chrome.* thật (MV3).
 * Khai báo tối thiểu theo API dùng trong test.
 */
declare const chrome: {
  runtime: {
    id: string;
    getURL: (path: string) => string;
    sendMessage: (message: unknown) => Promise<unknown>;
  };
  alarms: {
    getAll: () => Promise<Array<{ name: string }>>;
    clear: (name: string) => Promise<boolean>;
    create: (name: string, info: { when: number }) => void;
  };
};
