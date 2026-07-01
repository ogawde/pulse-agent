import { buildProactiveAlertBlocks } from '../../lib/slack/alert-blocks.ts'
import { resolvePeopleOpsChannelId } from '../../lib/worker/notify.ts'
import { runAlertCheck } from '../../lib/worker/run-alert-check.ts'
import { getOpenAlerts } from './pulse-data.js'

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_STARTUP_DELAY_MS = 30 * 1000

/** One card per team (getOpenAlerts is newest-first). */
function dedupeAlertsByTeam(alerts) {
  const seen = new Set()
  const unique = []
  for (const alert of alerts) {
    const key = alert.team.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(alert)
  }
  return unique
}

/**
 * @param {import('@slack/web-api').WebClient} client
 * @param {import('@slack/bolt').Logger} logger
 * @param {Array<{ id: string, team: string, title: string, summary: string, severity: string, signalDrivers: string[] }>} alerts
 * @param {string} [peopleOpsChannelId]
 */
async function postAlertsToPeopleOps(client, logger, alerts, peopleOpsChannelId) {
  const channelId = await resolvePeopleOpsChannelId(client, peopleOpsChannelId)
  if (!channelId) {
    logger.warn(
      'Could not find #people-ops. Run /invite @Pulse in that channel or set PULSE_PEOPLE_OPS_CHANNEL_ID.',
    )
    return { posted: 0, channelId: null }
  }

  for (const alert of alerts) {
    await client.chat.postMessage({
      channel: channelId,
      blocks: buildProactiveAlertBlocks(alert),
      text: `Pulse alert: ${alert.title}`,
    })
  }

  return { posted: alerts.length, channelId }
}

/**
 * Post new alerts to #people-ops and return count created.
 * @param {import('@slack/bolt').App | { client: import('@slack/web-api').WebClient, logger: import('@slack/bolt').Logger }} app
 */
export async function runScheduledAlertCheck(app) {
  const created = await runAlertCheck()
  if (created.length === 0) return 0

  const { posted, channelId } = await postAlertsToPeopleOps(app.client, app.logger, created)
  if (!channelId) return 0

  app.logger.info(`Posted ${posted} proactive alert(s) to #people-ops`)
  return posted
}

/**
 * Manual /pulse check-alerts: create new alerts, or re-post existing open ones to #people-ops.
 * @param {{ client: import('@slack/web-api').WebClient, logger: import('@slack/bolt').Logger }} app
 * @param {{ peopleOpsChannelId?: string }} [options]
 */
export async function runManualAlertCheck(app, options = {}) {
  const created = await runAlertCheck()
  const openAlerts = dedupeAlertsByTeam(await getOpenAlerts())
  const toPost = created.length > 0 ? created : openAlerts

  if (toPost.length === 0) {
    return { created: 0, posted: 0, resent: false }
  }

  const { posted, channelId } = await postAlertsToPeopleOps(
    app.client,
    app.logger,
    toPost,
    options.peopleOpsChannelId,
  )
  if (!channelId) {
    return { created: created.length, posted: 0, resent: false, channelMissing: true }
  }

  if (posted > 0) {
    app.logger.info(
      created.length > 0
        ? `Posted ${posted} new alert(s) to #people-ops`
        : `Re-posted ${posted} existing open alert(s) to #people-ops`,
    )
  }

  return { created: created.length, posted, resent: created.length === 0 }
}

/**
 * Start periodic alert checks while slack run is active (local demo + dev).
 * @param {import('@slack/bolt').App} app
 */
export function startAlertScheduler(app) {
  const intervalMs = Number.parseInt(process.env.PULSE_ALERT_INTERVAL_MS ?? String(DEFAULT_INTERVAL_MS), 10)
  const startupDelayMs = Number.parseInt(
    process.env.PULSE_ALERT_STARTUP_DELAY_MS ?? String(DEFAULT_STARTUP_DELAY_MS),
    10,
  )

  const tick = async () => {
    try {
      await runScheduledAlertCheck(app)
    } catch (e) {
      app.logger.error(`Scheduled alert check failed: ${e}`)
    }
  }

  app.logger.info(
    `Alert scheduler: first run in ${startupDelayMs / 1000}s, then every ${intervalMs / 1000}s`,
  )

  setTimeout(tick, startupDelayMs)
  setInterval(tick, intervalMs)
}
