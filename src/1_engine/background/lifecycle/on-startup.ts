import { browser } from 'wxt/browser';
import { createLogger } from '@platform/telemetry/logger';
import { scheduleKeepAlive } from './keep-alive';

const logger = createLogger('background');

export function registerOnStartup(): void {
  browser.runtime.onStartup.addListener(() => {
    logger.info('Startup — scheduling keep-alive');
    scheduleKeepAlive();
  });
}
