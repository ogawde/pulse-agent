import { handleFeedbackButton } from './feedback-buttons.js';
import { handleAcknowledgeAlert, handleSuggestCheckin } from './pulse-actions.js';

/**
 * Register action listeners with the Bolt app.
 * @param {import('@slack/bolt').App} app
 * @returns {void}
 */
export function register(app) {
  app.action('feedback', handleFeedbackButton);
  app.action('pulse_acknowledge_alert', handleAcknowledgeAlert);
  app.action('pulse_suggest_checkin', handleSuggestCheckin);
}
