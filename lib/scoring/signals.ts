import { isAfterHours } from '@/lib/utils/time'

export interface ScoringMessageEvent {
  text: string
  sentimentScore: number
  timestamp: string
  channel: string
  senderId?: string
  recipientIds?: string[]
}

function averageSentiment(events: ScoringMessageEvent[]): number {
  if (events.length === 0) return 0
  return events.reduce((sum, e) => sum + e.sentimentScore, 0) / events.length
}

function filterByDays(events: ScoringMessageEvent[], startDaysAgo: number, endDaysAgo: number) {
  const now = Date.now()
  return events.filter((e) => {
    const age = now - new Date(e.timestamp).getTime()
    const minMs = startDaysAgo * 86400000
    const maxMs = endDaysAgo * 86400000
    return age >= minMs && age < maxMs
  })
}

function detectEarlySentimentRisk(events: ScoringMessageEvent[]): number {
  const negatives = events.filter((e) => e.sentimentScore < -0.3)
  const negativeRatio = negatives.length / events.length
  const avg = averageSentiment(events)
  const avgNeg =
    negatives.length > 0
      ? negatives.reduce((sum, e) => sum + e.sentimentScore, 0) / negatives.length
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
    Math.round(Math.max(fromAvg, fromRatio, fromSeverity, fromVolume) * 10) / 10
  )
}

export function detectReceivedHostility(
  events: Array<ScoringMessageEvent & { recipientIds?: string[] }>,
  slackUserId: string
): number {
  const hostile = events.filter(
    (e) =>
      e.senderId !== slackUserId &&
      (e.recipientIds ?? []).includes(slackUserId) &&
      e.sentimentScore < -0.3
  )

  if (hostile.length === 0) return 0

  const avgHostility =
    hostile.reduce((sum, e) => sum + e.sentimentScore, 0) / hostile.length

  let fromCount = 0
  if (hostile.length >= 5) fromCount = 7.5
  else if (hostile.length >= 3) fromCount = 6
  else if (hostile.length >= 2) fromCount = 5
  else fromCount = 4

  let fromSeverity = 0
  if (avgHostility < -0.65) fromSeverity = 8.5
  else if (avgHostility < -0.5) fromSeverity = 7
  else if (avgHostility < -0.4) fromSeverity = 5.5

  return Math.min(10, Math.round(Math.max(fromCount, fromSeverity) * 10) / 10)
}

export function hasInsufficientHistory(events: ScoringMessageEvent[]): boolean {
  return filterByDays(events, 7, 28).length === 0
}

export function detectSentimentDrift(events: ScoringMessageEvent[]): number {
  const recent = filterByDays(events, 0, 7)
  const previous = filterByDays(events, 7, 28)

  if (recent.length === 0) return 0

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

export function detectAfterHours(events: ScoringMessageEvent[]): number {
  const cutoff = Date.now() - 14 * 86400000
  const count = events.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoff && isAfterHours(e.timestamp)
  ).length

  if (count === 0) return 0
  if (count <= 3) return 2
  if (count <= 7) return 5
  if (count <= 14) return 7
  return 9
}

export function detectChannelExclusion(
  currentChannels: string[],
  previousChannels: string[]
): number {
  const current = new Set(currentChannels)
  const lost = previousChannels.filter((c) => !current.has(c)).length

  if (lost === 0) return 0
  if (lost === 1) return 2
  if (lost === 2) return 5
  if (lost === 3) return 7
  return 9
}

export function detectResponseDrop(recentReplyRate: number, baselineReplyRate: number): number {
  if (baselineReplyRate <= 0) return 0
  const ratio = recentReplyRate / baselineReplyRate
  if (ratio < 0.3) return 9
  if (ratio < 0.5) return 7
  return 0
}

export function activeSignalsFromScores(signals: {
  sentimentDrift: number
  afterHours: number
  channelExclusion: number
  responseDrop: number
}): string[] {
  const active: string[] = []
  if (signals.sentimentDrift >= 3) active.push('sentiment_drift')
  if (signals.afterHours >= 2) active.push('after_hours')
  if (signals.channelExclusion >= 2) active.push('channel_exclusion')
  if (signals.responseDrop >= 7) active.push('response_drop')
  return active
}
