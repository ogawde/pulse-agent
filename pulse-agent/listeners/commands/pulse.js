import { runManualAlertCheck } from '../../lib/alert-scheduler.js';
import { getTeamHealthSummary } from '../../lib/health.js';
import { buildHealthSummaryBlocks, buildPulseIntroBlocks } from '../views/pulse-blocks.js';

/**
 * Handle /pulse slash command.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackCommandMiddlewareArgs} args
 * @returns {Promise<void>}
 */
export async function handlePulseCommand({ ack, client, command, logger, respond }) {
  await ack();

  const subcommand = (command.text || '').trim().toLowerCase() || 'help';

  try {
    if (subcommand === 'help') {
      await respond({
        response_type: 'ephemeral',
        blocks: buildPulseIntroBlocks(),
        text: 'Pulse — Team health pulse checks, not surveillance.',
      });
      return;
    }

    if (subcommand === 'health') {
      const summary = await getTeamHealthSummary(command.team_id);
      await respond({
        response_type: 'in_channel',
        blocks: buildHealthSummaryBlocks(summary),
        text: 'Team health summary from Pulse',
      });
      return;
    }

    if (subcommand === 'check-alerts') {
      const peopleOpsChannelId =
        command.channel_name === 'people-ops' ? command.channel_id : undefined;
      const result = await runManualAlertCheck({ client, logger }, { peopleOpsChannelId });

      if (result.channelMissing) {
        await respond({
          response_type: 'ephemeral',
          text:
            ':warning: Could not find #people-ops. Create the channel and run `/invite @Pulse` there, then try again.',
        });
        return;
      }

      if (result.posted === 0) {
        await respond({
          response_type: 'ephemeral',
          text: ':information_source: No alerts to post. All teams look stable.',
        });
        return;
      }

      const verb = result.resent ? 'Re-posted' : 'Created and posted';
      await respond({
        response_type: 'ephemeral',
        text: `:white_check_mark: ${verb} ${result.posted} alert(s) to #people-ops.`,
      });
      return;
    }

    await respond({
      response_type: 'ephemeral',
      text: `Unknown subcommand \`${subcommand}\`. Try \`/pulse health\`, \`/pulse check-alerts\`, or \`/pulse help\`.`,
    });
  } catch (e) {
    logger.error(`Failed to handle /pulse command: ${e}`);
    await respond({
      response_type: 'ephemeral',
      text: `:warning: /pulse ${subcommand} failed: ${e}`,
    });
  }
}

/**
 * Post Pulse intro card in a thread (used for empty @mentions).
 * @param {import('@slack/web-api').WebClient} client
 * @param {string} channelId
 * @param {string} threadTs
 * @returns {Promise<void>}
 */
export async function postPulseIntro(client, channelId, threadTs) {
  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    blocks: buildPulseIntroBlocks(),
    text: 'Pulse — Team health pulse checks, not surveillance.',
  });
}
