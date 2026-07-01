import { computeCompositeRisk } from './composite.js'
import { scoreTeamMessagesSentiment } from './sentiment.js'
import {
  activeSignalsFromScores,
  computeTeamSignals,
  hasInsufficientHistory,
  type ScoringMessageEvent,
  type TeamSignalScores,
} from './signals.js'

export type TeamRtsMessage = {
  content?: string
  message_ts?: string
  channel_id?: string
  channel_name?: string
}

export type TeamScoringResult = TeamSignalScores & {
  compositeScore: number
  level: 'normal' | 'watch' | 'warning' | 'critical'
  activeSignals: string[]
  messageCount: number
}

function toRawEvents(messages: TeamRtsMessage[]) {
  return messages
    .filter((m) => m.content && m.message_ts)
    .map((m) => ({
      text: m.content!,
      timestamp: new Date(Number.parseFloat(m.message_ts!) * 1000).toISOString(),
      channel: m.channel_id ?? m.channel_name ?? 'unknown',
    }))
}

/**
 * Score from RTS messages with optional in-memory sentiment (not persisted).
 * Prefer scoreTeamFromMetadata() for the production RTS path.
 */
export async function scoreTeamFromRtsMessages(
  messages: TeamRtsMessage[],
  options?: {
    baselineChannelIds?: string[]
    useOpenRouter?: boolean
  },
): Promise<TeamScoringResult | null> {
  const raw = toRawEvents(messages)
  if (raw.length === 0) return null

  const events: ScoringMessageEvent[] = await scoreTeamMessagesSentiment(raw, {
    useOpenRouter: options?.useOpenRouter,
  })

  const signals = computeTeamSignals(events, {
    baselineChannelIds: options?.baselineChannelIds,
  })

  const composite = computeCompositeRisk(signals, {
    earlyData: hasInsufficientHistory(events),
  })

  return {
    ...signals,
    compositeScore: composite.score,
    level: composite.level,
    activeSignals: activeSignalsFromScores(signals),
    messageCount: events.length,
  }
}

export { scoreTeamFromMetadata } from './metadata.js'
