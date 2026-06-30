import 'dotenv/config'
import { desc, eq } from 'drizzle-orm'

import { createDb } from './client.js'
import { alerts, signalSnapshots, teams, workspaces } from './schema.js'

const DEMO_WORKSPACE = {
  slackTeamId: 'T_DEMO_PULSE',
  name: 'Pulse Demo Workspace',
}

const DEMO_TEAMS = [
  {
    name: 'Engineering',
    slackChannelIds: ['C_ENGINEERING'],
    snapshot: {
      sentimentDrift: 4.2,
      afterHours: 6.1,
      channelExclusion: 2.0,
      responseDrop: 3.5,
      compositeScore: 4.8,
      level: 'watch' as const,
    },
  },
  {
    name: 'Design',
    slackChannelIds: ['C_DESIGN'],
    snapshot: {
      sentimentDrift: 2.1,
      afterHours: 1.5,
      channelExclusion: 0,
      responseDrop: 0,
      compositeScore: 1.8,
      level: 'normal' as const,
    },
  },
  {
    name: 'People Ops',
    slackChannelIds: ['C_PEOPLE_OPS'],
    snapshot: {
      sentimentDrift: 5.8,
      afterHours: 7.2,
      channelExclusion: 4.5,
      responseDrop: 6.0,
      compositeScore: 6.2,
      level: 'warning' as const,
    },
  },
]

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const db = createDb(databaseUrl)

  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slackTeamId, DEMO_WORKSPACE.slackTeamId))
    .limit(1)

  if (existing.length > 0) {
    console.log('Demo workspace already seeded, skipping.')
    return
  }

  const [workspace] = await db
    .insert(workspaces)
    .values(DEMO_WORKSPACE)
    .returning()

  for (const team of DEMO_TEAMS) {
    const [row] = await db
      .insert(teams)
      .values({
        workspaceId: workspace.id,
        name: team.name,
        slackChannelIds: team.slackChannelIds,
      })
      .returning()

    await db.insert(signalSnapshots).values({
      teamId: row.id,
      ...team.snapshot,
    })
  }

  const engineeringTeam = await db
    .select()
    .from(teams)
    .where(eq(teams.name, 'Engineering'))
    .limit(1)

  if (engineeringTeam[0]) {
    await db.insert(alerts).values({
      teamId: engineeringTeam[0].id,
      severity: 'medium',
      status: 'open',
      title: 'After-hours activity rising in Engineering',
      summary:
        'Engineering shows elevated after-hours messaging this week. Consider a wellbeing check-in.',
      signalDrivers: ['after_hours', 'sentiment_drift'],
    })
  }

  const latest = await db
    .select({
      team: teams.name,
      score: signalSnapshots.compositeScore,
      level: signalSnapshots.level,
    })
    .from(signalSnapshots)
    .innerJoin(teams, eq(signalSnapshots.teamId, teams.id))
    .orderBy(desc(signalSnapshots.scoredAt))

  console.log('Seeded demo workspace with team snapshots:')
  for (const row of latest) {
    console.log(`  ${row.team}: ${row.score} (${row.level})`)
  }
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
