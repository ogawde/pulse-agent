import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Load repo-root .env first, then local overrides
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(rootDir, '.env') });
config({ path: resolve(rootDir, 'pulse-agent', '.env') });

import { App, LogLevel } from '@slack/bolt';

import { registerListeners } from './listeners/index.js';
import { startAlertScheduler } from './lib/alert-scheduler.js';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.DEBUG,
  ignoreSelf: false,
});

registerListeners(app);

(async () => {
  await app.start();
  app.logger.info('Pulse agent is running!');
  startAlertScheduler(app);
})();
