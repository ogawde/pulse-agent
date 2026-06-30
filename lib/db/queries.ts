import { and, desc, eq, ilike } from 'drizzle-orm'

import { createDb, type PulseDb } from './client.js'
import { alertEvents, alerts, signalSnapshots, teams } from './schema.js'

export type TeamSignals = {
  sentimentDrift: number
  afterHours: number
  channelExclusion: number
  responseDrop: number
}

export type TeamSummary = {
  team: string
  compositeScore: number
  level: string
  scoredAt: string
  signals: TeamSignals
  activeSignals: string[]
}

export type OpenAlert = {
  id: string
  team: string
  severity: string
  title: string
  summary: string
  signalDrivers: string[]
  firedAt: string
}

function requireDb(): PulseDb {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }
  return createDb(databaseUrl)
}

function activeSignalsFromScores(signals: TeamSignals): string[] {
  const active: string[] = []
  if (signals.sentimentDrift >= 3) active.push('sentiment_drift')
  if (signals.afterHours >= 2) active.push('after_hours')
  if (signals.channelExclusion >= 2) active.push('channel_exclusion')
  if (signals.responseDrop >= 7) active.push('response_drop')
  return active
}

function mapSnapshotRow(row: {
  team: string
  compositeScore: number
  level: string
  scoredAt: Date
  sentimentDrift: number
  afterHours: number
  channelExclusion: number
  responseDrop: number
}): TeamSummary {
  const signals: TeamSignals = {
    sentimentDrift: row.sentimentDrift,
    afterHours: row.afterHours,
    channelExclusion: row.channelExclusion,
    responseDrop: row.responseDrop,
  }

  return {
    team: row.team,
    compositeScore: row.compositeScore,
    level: row.level,
    scoredAt: row.scoredAt.toISOString(),
    signals,
    activeSignals: activeSignalsFromScores(signals),
  }
}

/**
 * Latest aggregate snapshot for a team (case-insensitive, partial name match).
 */
export async function getTeamSummary(teamName: string): Promise<TeamSummary | null> {
  const db = requireDb()
  const needle = teamName.trim()
  if (!needle) return null

  const rows = await db
    .select({
      team: teams.name,
      compositeScore: signalSnapshots.compositeScore,
      level: signalSnapshots.level,
      scoredAt: signalSnapshots.scoredAt,
      sentimentDrift: signalSnapshots.sentimentDrift,
      afterHours: signalSnapshots.afterHours,
      channelExclusion: signalSnapshots.channelExclusion,
      responseDrop: signalSnapshots.responseDrop,
    })
    .from(signalSnapshots)
    .innerJoin(teams, eq(signalSnapshots.teamId, teams.id))
    .where(ilike(teams.name, `%${needle}%`))
    .orderBy(desc(signalSnapshots.scoredAt))
    .limit(1)

  if (rows.length === 0) return null
  return mapSnapshotRow(rows[0])
}

/**
 * Open HR alerts across the workspace (demo data when sandbox is not seeded).
 */
export async function getOpenAlerts(): Promise<OpenAlert[]> {
  const db = requireDb()

  const rows = await db
    .select({
      id: alerts.id,
      team: teams.name,
      severity: alerts.severity,
      title: alerts.title,
      summary: alerts.summary,
      signalDrivers: alerts.signalDrivers,
      firedAt: alerts.firedAt,
    })
    .from(alerts)
    .innerJoin(teams, eq(alerts.teamId, teams.id))
    .where(eq(alerts.status, 'open'))
    .orderBy(desc(alerts.firedAt))

  return rows.map((row) => ({
    id: row.id,
    team: row.team,
    severity: row.severity,
    title: row.title,
    summary: row.summary,
    signalDrivers: row.signalDrivers ?? [],
    firedAt: row.firedAt.toISOString(),
  }))
}

export type AcknowledgeAlertResult = {
  ok: boolean
  alertId: string
  status: string
  acknowledgedAt: string
}

/**
 * Mark an alert acknowledged and record an audit event.
 */
export async function acknowledgeAlert(
  alertId: string,
  actorSlackId: string,
): Promise<AcknowledgeAlertResult> {
  const db = requireDb()
  const now = new Date()

  const updated = await db
    .update(alerts)
    .set({
      status: 'acknowledged',
      acknowledgedAt: now,
    })
    .where(and(eq(alerts.id, alertId), eq(alerts.status, 'open')))
    .returning({ id: alerts.id })

  if (updated.length === 0) {
    throw new Error(`Alert not found or already acknowledged: ${alertId}`)
  }

  await db.insert(alertEvents).values({
    alertId,
    actorSlackId,
    action: 'acknowledged',
  })

  return {
    ok: true,
    alertId,
    status: 'acknowledged',
    acknowledgedAt: now.toISOString(),
  }
}
