import 'dotenv/config'
import { createServer } from 'node:http'

import { WebClient } from '@slack/web-api'

import { buildProactiveAlertBlocks } from '../lib/slack/alert-blocks.js'
import { resolvePeopleOpsChannelId } from '../lib/worker/notify.js'
import { runAlertCheck } from '../lib/worker/run-alert-check.js'

const PORT = Number.parseInt(process.env.PULSE_WORKER_PORT ?? '3200', 10)
const CRON_PATH = '/api/cron/alerts'

function unauthorized(res: import('node:http').ServerResponse) {
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }))
}

async function handleCronAlerts(notify: boolean) {
  const created = await runAlertCheck()
  let posted = 0
  let channelId: string | null = null

  if (notify && created.length > 0) {
    const token = process.env.SLACK_BOT_TOKEN
    if (!token) {
      return { ok: false, error: 'SLACK_BOT_TOKEN required for notify', created, posted: 0 }
    }

    const client = new WebClient(token)
    channelId = await resolvePeopleOpsChannelId(client)

    if (!channelId) {
      return { ok: false, error: 'Could not resolve #people-ops', created, posted: 0 }
    }

    for (const alert of created) {
      await client.chat.postMessage({
        channel: channelId,
        blocks: buildProactiveAlertBlocks(alert),
        text: `Pulse alert: ${alert.title}`,
      })
      posted++
    }
  }

  return { ok: true, created, posted, channelId }
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method !== 'POST' || url.pathname !== CRON_PATH) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const secret = process.env.CRON_SECRET
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (secret && auth !== secret) {
    unauthorized(res)
    return
  }

  const notify = url.searchParams.get('notify') === 'true'

  try {
    const result = await handleCronAlerts(notify)
    res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: String(err) }))
  }
})

httpServer.listen(PORT, () => {
  console.log(`Pulse worker listening on http://localhost:${PORT}${CRON_PATH}`)
  console.log('POST with ?notify=true to post new alerts to #people-ops')
})
