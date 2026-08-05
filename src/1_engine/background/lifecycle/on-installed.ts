import { browser } from 'wxt/browser';
import { createLogger } from '@platform/telemetry/logger';

const logger = createLogger('background');

export function registerOnInstalled(): void {
  browser.runtime.onInstalled.addListener((details) => {
    logger.info(`Installed — reason: ${details.reason}`, { reason: details.reason });
  });
}
