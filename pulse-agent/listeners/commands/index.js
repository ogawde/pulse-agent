import { handlePulseCommand } from './pulse.js';

/**
 * Register slash command listeners.
 * @param {import('@slack/bolt').App} app
 * @returns {void}
 */
export function register(app) {
  app.command('/pulse', handlePulseCommand);
}
