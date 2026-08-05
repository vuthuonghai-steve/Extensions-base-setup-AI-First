import { defineBackground } from '#imports';
import { Router } from '@platform/ipc/router';
import { registerInfrastructureHandlers } from '@platform/ipc/infrastructure-handlers';
import { registerMessageListener } from './listeners/message-listener';
import { registerAlarmsListener } from './listeners/alarms-listener';
import { registerOnInstalled } from './lifecycle/on-installed';
import { registerOnStartup } from './lifecycle/on-startup';
import { scheduleKeepAlive } from './lifecycle/keep-alive';

/**
 * Background bootstrap (Architect §3 — D1 Phase 5). Engine chỉ Register & Listen:
 * Router instance DUY NHẤT module-level; mọi đăng ký (handler + listener) chạy
 * TRONG defineBackground — tránh side-effect browser API lúc module eval
 * (wxt prepare/build dùng fake-browser, chặn runtime.onConnect).
 */
const router = new Router();

export default defineBackground(() => {
  registerInfrastructureHandlers(router);
  registerMessageListener(router);
  registerAlarmsListener();
  registerOnInstalled();
  registerOnStartup();
  scheduleKeepAlive();
});
