import 'dotenv/config'

import { WebClient } from '@slack/web-api'

import { buildProactiveAlertBlocks } from '../lib/slack/alert-blocks.js'
import type { OpenAlert } from '../lib/db/queries.js'
import { resolvePeopleOpsChannelId } from '../lib/worker/notify.js'
import { runAlertCheck } from '../lib/worker/run-alert-check.js'

async function postAlerts(client: WebClient, channelId: string, alerts: OpenAlert[]) {
  for (const alert of alerts) {
    await client.chat.postMessage({
      channel: channelId,
      blocks: buildProactiveAlertBlocks(alert),
      text: `Pulse alert: ${alert.title}`,
    })
  }
}

async function main() {
  const token = process.env.SLACK_BOT_TOKEN
  const notify = process.argv.includes('--notify')

  const created = await runAlertCheck()

  console.log(`Alert check complete: ${created.length} new alert(s)`)
  for (const alert of created) {
    console.log(`  - ${alert.team}: ${alert.title} (${alert.severity})`)
  }

  if (!notify) {
    if (created.length > 0) {
      console.log('\nRun with --notify to post to #people-ops (requires SLACK_BOT_TOKEN)')
    }
    return
  }

  if (!token) {
    console.error('SLACK_BOT_TOKEN required for --notify')
    process.exit(1)
  }

  if (created.length === 0) return

  const client = new WebClient(token)
  const channelId = await resolvePeopleOpsChannelId(client)
  if (!channelId) {
    console.error('Could not find #people-ops. Set PULSE_PEOPLE_OPS_CHANNEL_ID or invite @Pulse to the channel.')
    process.exit(1)
  }

  await postAlerts(client, channelId, created)
  console.log(`Posted ${created.length} alert(s) to #people-ops`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
