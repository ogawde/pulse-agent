import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node'
import { McpServer } from '@modelcontextprotocol/server'
import { config } from 'dotenv'
import * as z from 'zod'

import {
  acknowledgeAlert,
  getOpenAlerts,
  getTeamSummary,
  insertTeamSnapshot,
  type SnapshotInput,
} from '../lib/db/queries.js'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: resolve(rootDir, '.env') })

const PORT = Number.parseInt(process.env.PULSE_MCP_PORT ?? '3100', 10)
const MCP_PATH = '/mcp'

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  }
}

function createPulseMcpServer() {
  const server = new McpServer({
    name: 'pulse',
    version: '0.1.0',
  })

  server.registerTool(
    'get_team_summary',
    {
      title: 'Get team summary',
      description:
        'Returns aggregate risk level and signal breakdown for a department or team (e.g. Engineering, Design). No individual employee data.',
      inputSchema: z.object({
        team: z.string().describe('Team or department name'),
      }),
    },
    async ({ team }) => {
      const summary = await getTeamSummary(team)
      if (!summary) {
        return jsonResult({
          found: false,
          team,
          message: `No snapshot found for team matching "${team}".`,
        })
      }
      return jsonResult({ found: true, ...summary })
    },
  )

  server.registerTool(
    'get_open_alerts',
    {
      title: 'Get open alerts',
      description: 'Returns active HR wellbeing alerts for the workspace.',
      inputSchema: z.object({}),
    },
    async () => {
      const openAlerts = await getOpenAlerts()
      return jsonResult({ count: openAlerts.length, alerts: openAlerts })
    },
  )

  server.registerTool(
    'acknowledge_alert',
    {
      title: 'Acknowledge alert',
      description:
        'Marks an open alert as acknowledged. Requires the Slack user ID of the HR person acknowledging.',
      inputSchema: z.object({
        alert_id: z.string().uuid().describe('Alert UUID from get_open_alerts'),
        actor_slack_id: z.string().describe('Slack user ID of the person acknowledging'),
      }),
    },
    async ({ alert_id, actor_slack_id }) => {
      const result = await acknowledgeAlert(alert_id, actor_slack_id)
      return jsonResult(result)
    },
  )

  server.registerTool(
    'record_signal_snapshot',
    {
      title: 'Record signal snapshot',
      description:
        'Store computed team-level aggregate scores after an RTS pass. No message text — scores only.',
      inputSchema: z.object({
        team: z.string().describe('Team or department name'),
        sentiment_drift: z.number(),
        after_hours: z.number(),
        channel_exclusion: z.number(),
        response_drop: z.number(),
        composite_score: z.number(),
        level: z.enum(['normal', 'watch', 'warning', 'critical']),
      }),
    },
    async (input) => {
      const snapshot: SnapshotInput = {
        sentimentDrift: input.sentiment_drift,
        afterHours: input.after_hours,
        channelExclusion: input.channel_exclusion,
        responseDrop: input.response_drop,
        compositeScore: input.composite_score,
        level: input.level,
      }
      const teamId = await insertTeamSnapshot(input.team, snapshot)
      if (!teamId) {
        return jsonResult({ ok: false, team: input.team, message: 'Team not found' })
      }
      const summary = await getTeamSummary(input.team)
      return jsonResult({ ok: true, teamId, summary })
    },
  )

  return server
}

const mcpServer = createPulseMcpServer()

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (url.pathname !== MCP_PATH) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await mcpServer.connect(transport)
  await transport.handleRequest(req, res)
})

httpServer.listen(PORT, () => {
  console.log(`Pulse MCP server listening on http://localhost:${PORT}${MCP_PATH}`)
})
