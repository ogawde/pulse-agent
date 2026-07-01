import type { ActivityEvent } from '../rts/metadata.js'
import { isAfterHours } from '../utils/time.js'

/** In-memory event for team aggregate scoring. No per-person surveillance. */
export interface ScoringMessageEvent extends ActivityEvent {
  text?: string
  sentimentScore?: number
}

export type TeamSignalScores = {
  sentimentDrift: number
  afterHours: number
  channelExclusion: number
  responseDrop: number
}

export type TeamSignalContext = {
  /** Configured team channels (from Neon teams.slack_channel_ids) */
  baselineChannelIds?: string[]
}

function averageSentiment(events: ScoringMessageEvent[]): number {
  const scored = events.filter((e) => e.sentimentScore !== undefined)
  if (scored.length === 0) return 0
  return scored.reduce((sum, e) => sum + (e.sentimentScore ?? 0), 0) / scored.length
}

function hasSentimentScores(events: ScoringMessageEvent[]): boolean {
  return events.some((e) => e.sentimentScore !== undefined && e.sentimentScore !== 0)
}

function filterByDays(events: ActivityEvent[], startDaysAgo: number, endDaysAgo: number) {
  const now = Date.now()
  return events.filter((e) => {
    const age = now - new Date(e.timestamp).getTime()
    const minMs = startDaysAgo * 86400000
    const maxMs = endDaysAgo * 86400000
    return age >= minMs && age < maxMs
  })
}

function detectEarlySentimentRisk(events: ScoringMessageEvent[]): number {
  const negatives = events.filter((e) => (e.sentimentScore ?? 0) < -0.3)
  const negativeRatio = negatives.length / events.length
  const avg = averageSentiment(events)
  const avgNeg =
    negatives.length > 0
      ? negatives.reduce((sum, e) => sum + (e.sentimentScore ?? 0), 0) / negatives.length
      : 0

  let fromAvg = 0
  if (avg < -0.5) fromAvg = 8 + Math.min(2, (-0.5 - avg) * 4)
  else if (avg < -0.3) fromAvg = 5 + ((-0.3 - avg) / 0.2) * 3
  else if (avg < -0.1) fromAvg = 2 + ((-0.1 - avg) / 0.2) * 3
  else if (avg < 0.1) fromAvg = 1

  let fromRatio = 0
  if (negativeRatio >= 0.35) fromRatio = 9.5
  else if (negativeRatio >= 0.2) fromRatio = 7 + ((negativeRatio - 0.2) / 0.15) * 2.5
  else if (negativeRatio >= 0.1) fromRatio = 4 + ((negativeRatio - 0.1) / 0.1) * 3
  else if (negativeRatio > 0) fromRatio = 2

  let fromSeverity = 0
  if (avgNeg < -0.65) fromSeverity = 9.5
  else if (avgNeg < -0.5) fromSeverity = 8
  else if (avgNeg < -0.4) fromSeverity = 6.5

  let fromVolume = 0
  if (negatives.length >= 20) fromVolume = 9.5
  else if (negatives.length >= 12) fromVolume = 8
  else if (negatives.length >= 6) fromVolume = 6
  else if (negatives.length >= 3) fromVolume = 4

  return Math.min(
    10,
    Math.round(Math.max(fromAvg, fromRatio, fromSeverity, fromVolume) * 10) / 10,
  )
}

export function hasInsufficientHistory(events: ActivityEvent[]): boolean {
  return filterByDays(events, 7, 28).length === 0
}

/**
 * Engagement stress proxy from metadata (volume + after-hours ratio shifts).
 * Used when message text is not available — RTS metadata-only path.
 */
export function detectEngagementDrift(events: ActivityEvent[]): number {
  const recent = filterByDays(events, 0, 7)
  const previous = filterByDays(events, 7, 28)

  if (recent.length === 0) return 0

  if (previous.length === 0) {
    const afterHoursRecent = recent.filter((e) => isAfterHours(e.timestamp)).length
    const ratio = afterHoursRecent / recent.length
    if (ratio >= 0.5) return 8
    if (ratio >= 0.3) return 5
    if (ratio >= 0.15) return 3
    return 0
  }

  const recentPerDay = recent.length / 7
  const previousPerDay = previous.length / 21
  const volumeRatio = recentPerDay / Math.max(previousPerDay, 0.1)

  const recentAfterHoursRatio =
    recent.filter((e) => isAfterHours(e.timestamp)).length / recent.length
  const previousAfterHoursRatio =
    previous.filter((e) => isAfterHours(e.timestamp)).length / previous.length
  const afterHoursIncrease = recentAfterHoursRatio - previousAfterHoursRatio

  let score = 0
  if (volumeRatio < 0.5) score = Math.max(score, 7)
  else if (volumeRatio < 0.7) score = Math.max(score, 4)

  if (afterHoursIncrease > 0.2) score = Math.max(score, 8)
  else if (afterHoursIncrease > 0.1) score = Math.max(score, 5)
  else if (afterHoursIncrease > 0.05) score = Math.max(score, 3)

  return Math.min(10, score)
}

/** Team-level sentiment drift (recent week vs prior weeks). */
export function detectSentimentDrift(events: ScoringMessageEvent[]): number {
  const recent = filterByDays(events, 0, 7)
  const previous = filterByDays(events, 7, 28)

  if (recent.length === 0) return 0

  if (!hasSentimentScores(events)) {
    return detectEngagementDrift(events)
  }

  if (previous.length === 0) {
    return detectEarlySentimentRisk(recent)
  }

  const recentAvg = averageSentiment(recent)
  const previousAvg = averageSentiment(previous)
  const drop = previousAvg - recentAvg

  if (drop <= 0.25) return 0
  if (drop > 0.5) return Math.min(10, 8 + (drop - 0.5) * 4)
  return 3 + ((drop - 0.25) / 0.25) * 5
}

/** Team after-hours messaging volume (aggregate, not per-person). */
export function detectAfterHours(events: ActivityEvent[]): number {
  const cutoff = Date.now() - 14 * 86400000
  const count = events.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoff && isAfterHours(e.timestamp),
  ).length

  if (count === 0) return 0
  if (count <= 3) return 2
  if (count <= 7) return 5
  if (count <= 14) return 7
  return 9
}

/** Channels the team stopped participating in vs baseline. */
export function detectChannelExclusion(
  currentChannels: string[],
  previousChannels: string[],
): number {
  const current = new Set(currentChannels)
  const lost = previousChannels.filter((c) => !current.has(c)).length

  if (lost === 0) return 0
  if (lost === 1) return 2
  if (lost === 2) return 5
  if (lost === 3) return 7
  return 9
}

/** Team message volume drop (proxy for participation / response patterns). */
export function detectResponseDrop(recentVolume: number, baselineVolume: number): number {
  if (baselineVolume <= 0) return 0
  const ratio = recentVolume / baselineVolume
  if (ratio < 0.3) return 9
  if (ratio < 0.5) return 7
  return 0
}

function detectTeamParticipationDrop(events: ActivityEvent[]): number {
  const recent = filterByDays(events, 0, 7).length
  const previous = filterByDays(events, 7, 14).length
  return detectResponseDrop(recent, previous)
}

function activeChannelsInWindow(events: ActivityEvent[], startDays: number, endDays: number) {
  return [...new Set(filterByDays(events, startDays, endDays).map((e) => e.channel))]
}

/**
 * Compute all team-level signal scores from in-memory RTS events.
 * No individual employee rankings.
 */
export function computeTeamSignals(
  events: ScoringMessageEvent[],
  context: TeamSignalContext = {},
): TeamSignalScores {
  const recentChannels = activeChannelsInWindow(events, 0, 7)
  const baseline = context.baselineChannelIds ?? []

  const channelExclusion =
    baseline.length > 0 ? detectChannelExclusion(recentChannels, baseline) : 0

  return {
    sentimentDrift: detectSentimentDrift(events),
    afterHours: detectAfterHours(events),
    channelExclusion,
    responseDrop: detectTeamParticipationDrop(events),
  }
}

export function activeSignalsFromScores(signals: TeamSignalScores): string[] {
  const active: string[] = []
  if (signals.sentimentDrift >= 3) active.push('sentiment_drift')
  if (signals.afterHours >= 2) active.push('after_hours')
  if (signals.channelExclusion >= 2) active.push('channel_exclusion')
  if (signals.responseDrop >= 7) active.push('response_drop')
  return active
}
