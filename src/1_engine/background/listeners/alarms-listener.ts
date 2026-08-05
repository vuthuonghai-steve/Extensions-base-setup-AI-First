import { browser } from 'wxt/browser';
import { createLogger } from '@platform/telemetry/logger';
import { handleKeepAliveAlarm, KEEP_ALIVE_ALARM } from '../lifecycle/keep-alive';

const logger = createLogger('background');

export function registerAlarmsListener(): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEP_ALIVE_ALARM) {
      void handleKeepAliveAlarm();
    } else {
      logger.warn(`Unknown alarm fired: ${alarm.name}`, { name: alarm.name });
    }
  });
}
