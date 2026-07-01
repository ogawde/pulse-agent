import { acknowledgeAlert } from '../../lib/pulse-data.js';

/**
 * Acknowledge an open HR alert from a Block Kit button.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs} args
 */
export async function handleAcknowledgeAlert({ ack, body, client, action, logger }) {
  await ack();

  const alertId = action.value;
  const userId = body.user.id;
  const channelId = body.channel?.id;
  const threadTs = body.message?.thread_ts ?? body.message?.ts;

  try {
    const result = await acknowledgeAlert(alertId, userId);

    if (channelId && threadTs) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `:white_check_mark: Alert acknowledged by <@${userId}>. Status: ${result.status}.`,
      });
    }
  } catch (e) {
    logger.error(`Failed to acknowledge alert: ${e}`);
    if (channelId) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: `:warning: Could not acknowledge alert: ${e}`,
      });
    }
  }
}

/**
 * Suggest a wellbeing check-in message for HR to send.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs} args
 */
export async function handleSuggestCheckin({ ack, body, client, action }) {
  await ack();

  const team = action.value;
  const userId = body.user.id;
  const channelId = body.channel?.id;

  if (!channelId) return;

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text:
      `*Suggested check-in for ${team}*\n\n` +
      'Hi team — checking in on how things are feeling this week. ' +
      'If workload or timing is tough, reply here or DM me. No pressure, just want to support you.',
  });
}
