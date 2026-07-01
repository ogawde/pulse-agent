import { parsePulseIntent } from '../../lib/intent.js';
import { getOpenAlerts, getTeamSummary } from '../../lib/pulse-data.js';
import { refreshTeamSnapshotFromRts } from '../../lib/rts-bridge.js';
import { buildOpenAlertsBlocks, buildTeamSummaryBlocks } from '../views/pulse-blocks.js';

/**
 * @param {string} teamName
 * @param {Array<{ team: string }>} alerts
 * @returns {{ id: string, title: string, severity: string } | null}
 */
function findTeamAlert(teamName, alerts) {
  const needle = teamName.toLowerCase();
  const match = alerts.find((a) => a.team.toLowerCase().includes(needle));
  return match ?? null;
}

/**
 * Handle structured Pulse queries with Block Kit + MCP-backed data.
 * @param {object} args
 * @param {string} args.text
 * @param {string} args.userId
 * @param {import('@slack/web-api').WebClient} args.client
 * @param {string} args.channelId
 * @param {string} args.threadTs
 * @param {string} [args.actionToken]
 * @param {string} [args.userToken]
 * @param {(message: object) => Promise<unknown>} args.say
 * @param {import('@slack/bolt').Logger} args.logger
 * @returns {Promise<boolean>} true if handled
 */
export async function tryHandlePulseQuery({ text, userId: _userId, client, channelId, threadTs, actionToken, userToken, say, logger }) {
  const intent = parsePulseIntent(text);
  if (!intent) return false;

  try {
    if (intent.type === 'open_alerts') {
      const alerts = await getOpenAlerts();
      await say({
        channel: channelId,
        thread_ts: threadTs,
        blocks: buildOpenAlertsBlocks(alerts),
        text: `Open alerts (${alerts.length})`,
      });
      return true;
    }

    if (intent.type === 'team_summary') {
      let summary = null;
      let liveRefresh = false;
      let rtsMeta = null;

      if (actionToken || userToken) {
        const refreshed = await refreshTeamSnapshotFromRts(client, {
          teamName: intent.team,
          actionToken,
          userToken,
        });
        if (refreshed?.summary) {
          summary = refreshed.summary;
          liveRefresh = refreshed.liveRefresh;
          rtsMeta = {
            messageCount: refreshed.messageCount,
            channelSlugs: refreshed.channelSlugs,
          };
        }
      }

      if (!summary) {
        summary = await getTeamSummary(intent.team);
      }

      if (!summary) {
        await say({
          channel: channelId,
          thread_ts: threadTs,
          text: `No team snapshot found for "${intent.team}". Try Engineering or Design.`,
        });
        return true;
      }

      const alerts = await getOpenAlerts();
      const teamAlert = findTeamAlert(summary.team, alerts);

      await say({
        channel: channelId,
        thread_ts: threadTs,
        blocks: buildTeamSummaryBlocks(summary, teamAlert, { liveRefresh, rtsMeta }),
        text: `${summary.team} team health — ${summary.level}`,
      });
      return true;
    }
  } catch (e) {
    logger.error(`Structured Pulse query failed: ${e}`);
    await say({
      channel: channelId,
      thread_ts: threadTs,
      text: ':warning: Could not load team health data. Is the MCP server running?',
    });
    return true;
  }

  return false;
}

/**
 * @param {object} event
 * @returns {string | undefined}
 */
export function getActionTokenFromEvent(event) {
  return /** @type {string | undefined} */ (event.action_token ?? event.metadata?.event_payload?.action_token);
}
