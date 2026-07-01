import { and, desc, eq, ilike } from 'drizzle-orm'

import { createDb, type PulseDb } from './client.js'
import { activeSignalsFromScores } from '../scoring/signals.js'
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

/**
 * Configured Slack channel IDs for a team (channel participation baseline).
 */
export async function getTeamBaselineChannelIds(teamName: string): Promise<string[]> {
  const db = requireDb()
  const needle = teamName.trim()

  const rows = await db
    .select({ slackChannelIds: teams.slackChannelIds })
    .from(teams)
    .where(ilike(teams.name, `%${needle}%`))
    .limit(1)

  return rows[0]?.slackChannelIds ?? []
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
 * Latest snapshot for every team in the workspace.
 */
export async function getAllLatestTeamSummaries(): Promise<TeamSummary[]> {
  const db = requireDb()

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
    .orderBy(teams.name, desc(signalSnapshots.scoredAt))

  const seen = new Set<string>()
  const summaries: TeamSummary[] = []

  for (const row of rows) {
    if (seen.has(row.team)) continue
    seen.add(row.team)
    summaries.push(mapSnapshotRow(row))
  }

  return summaries
}

/**
 * Whether a team already has an open alert (skip duplicate proactive fires).
 */
export async function hasOpenAlertForTeam(teamName: string): Promise<boolean> {
  const db = requireDb()
  const needle = teamName.trim()

  const rows = await db
    .select({ id: alerts.id })
    .from(alerts)
    .innerJoin(teams, eq(alerts.teamId, teams.id))
    .where(and(ilike(teams.name, `%${needle}%`), eq(alerts.status, 'open')))
    .limit(1)

  return rows.length > 0
}

export type InsertAlertInput = {
  teamName: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  summary: string
  signalDrivers: string[]
}

/**
 * Insert a new open alert for a team.
 */
export async function insertAlert(input: InsertAlertInput): Promise<string | null> {
  const db = requireDb()
  const needle = input.teamName.trim()

  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(ilike(teams.name, `%${needle}%`))
    .limit(1)

  if (teamRows.length === 0) return null

  const [row] = await db
    .insert(alerts)
    .values({
      teamId: teamRows[0].id,
      severity: input.severity,
      status: 'open',
      title: input.title,
      summary: input.summary,
      signalDrivers: input.signalDrivers,
    })
    .returning({ id: alerts.id })

  return row.id
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

export type SnapshotInput = {
  sentimentDrift: number
  afterHours: number
  channelExclusion: number
  responseDrop: number
  compositeScore: number
  level: 'normal' | 'watch' | 'warning' | 'critical'
}

/**
 * Insert a new point-in-time team snapshot (RTS refresh path).
 */
export async function insertTeamSnapshot(
  teamName: string,
  snapshot: SnapshotInput,
): Promise<string | null> {
  const db = requireDb()
  const needle = teamName.trim()

  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(ilike(teams.name, `%${needle}%`))
    .limit(1)

  if (teamRows.length === 0) return null

  await db.insert(signalSnapshots).values({
    teamId: teamRows[0].id,
    ...snapshot,
  })

  return teamRows[0].id
}
