import {
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const riskLevelEnum = pgEnum('risk_level', [
  'normal',
  'watch',
  'warning',
  'critical',
])

export const alertSeverityEnum = pgEnum('alert_severity', [
  'low',
  'medium',
  'high',
  'critical',
])

export const alertStatusEnum = pgEnum('alert_status', [
  'open',
  'acknowledged',
  'resolved',
])

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  slackTeamId: text('slack_team_id').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slackChannelIds: text('slack_channel_ids').array().notNull().default([]),
})

export const signalSnapshots = pgTable('signal_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  scoredAt: timestamp('scored_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  sentimentDrift: real('sentiment_drift').notNull().default(0),
  afterHours: real('after_hours').notNull().default(0),
  channelExclusion: real('channel_exclusion').notNull().default(0),
  responseDrop: real('response_drop').notNull().default(0),
  compositeScore: real('composite_score').notNull().default(0),
  level: riskLevelEnum('level').notNull().default('normal'),
})

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  severity: alertSeverityEnum('severity').notNull().default('medium'),
  status: alertStatusEnum('status').notNull().default('open'),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  signalDrivers: jsonb('signal_drivers').$type<string[]>().notNull().default([]),
  firedAt: timestamp('fired_at', { withTimezone: true }).defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
})

export const alertEvents = pgTable('alert_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id')
    .references(() => alerts.id, { onDelete: 'cascade' })
    .notNull(),
  actorSlackId: text('actor_slack_id').notNull(),
  action: text('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
