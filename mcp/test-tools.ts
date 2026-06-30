import 'dotenv/config'

import { getOpenAlerts, getTeamSummary } from '../lib/db/queries.js'

async function main() {
  console.log('Testing Pulse DB queries (MCP tool backends)...\n')

  const engineering = await getTeamSummary('Engineering')
  console.log('get_team_summary("Engineering"):')
  console.log(JSON.stringify(engineering, null, 2))

  const design = await getTeamSummary('Design')
  console.log('\nget_team_summary("Design"):')
  console.log(JSON.stringify(design, null, 2))

  const alerts = await getOpenAlerts()
  console.log('\nget_open_alerts():')
  console.log(JSON.stringify({ count: alerts.length, alerts }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
