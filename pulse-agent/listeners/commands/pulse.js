import { getTeamHealthSummary } from '../../lib/health.js';
import { buildHealthSummaryBlocks, buildPulseIntroBlocks } from '../views/pulse-blocks.js';

/**
 * Handle /pulse slash command.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackCommandMiddlewareArgs} args
 * @returns {Promise<void>}
 */
export async function handlePulseCommand({ ack, command, logger, respond }) {
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

    await respond({
      response_type: 'ephemeral',
      text: `Unknown subcommand \`${subcommand}\`. Try \`/pulse health\` or \`/pulse help\`.`,
    });
  } catch (e) {
    logger.error(`Failed to handle /pulse command: ${e}`);
    await respond({
      response_type: 'ephemeral',
      text: ':warning: Something went wrong fetching team health. Check DATABASE_URL and run migrations.',
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
