import { computeCompositeRisk } from './composite.js'
import {
  activeSignalsFromScores,
  detectAfterHours,
  detectChannelExclusion,
  detectEngagementDrift,
  detectResponseDrop,
  hasInsufficientHistory,
  type TeamSignalScores,
} from './signals.js'
import type { ActivityEvent, TeamActivityMetadata } from '../rts/metadata.js'

export type TeamScoringResult = TeamSignalScores & {
  compositeScore: number
  level: 'normal' | 'watch' | 'warning' | 'critical'
  activeSignals: string[]
  messageCount: number
}

/**
 * Score a team from RTS-derived metadata only (counts, timing, participation).
 * No message text is used or stored.
 */
export function scoreTeamFromMetadata(
  metadata: TeamActivityMetadata,
  options?: { baselineChannelIds?: string[] },
): TeamScoringResult | null {
  const events: ActivityEvent[] = metadata.events
  if (events.length === 0) return null

  const baseline = options?.baselineChannelIds ?? []
  const channelExclusion =
    baseline.length > 0
      ? detectChannelExclusion(metadata.activeChannelsRecent, baseline)
      : 0

  const signals: TeamSignalScores = {
    sentimentDrift: detectEngagementDrift(events),
    afterHours: detectAfterHours(events),
    channelExclusion,
    responseDrop: detectResponseDrop(metadata.recentWeekCount, metadata.priorWeekCount),
  }

  const composite = computeCompositeRisk(signals, {
    earlyData: hasInsufficientHistory(events),
  })

  return {
    ...signals,
    compositeScore: composite.score,
    level: composite.level,
    activeSignals: activeSignalsFromScores(signals),
    messageCount: metadata.totalMessages,
  }
}
