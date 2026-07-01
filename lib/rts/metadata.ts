import { isAfterHours } from '../utils/time.js'

import type { RtsMessage } from './search.js'

/** Timing + channel only. No message text. */
export type ActivityEvent = {
  timestamp: string
  channel: string
}

export type TeamActivityMetadata = {
  events: ActivityEvent[]
  totalMessages: number
  channelCounts: Record<string, number>
  afterHoursCount: number
  recentWeekCount: number
  priorWeekCount: number
  activeChannelsRecent: string[]
  activeChannelsPrior: string[]
}

function filterByDays(events: ActivityEvent[], startDaysAgo: number, endDaysAgo: number) {
  const now = Date.now()
  return events.filter((e) => {
    const age = now - new Date(e.timestamp).getTime()
    return age >= startDaysAgo * 86400000 && age < endDaysAgo * 86400000
  })
}

/**
 * Strip RTS hits down to aggregate metadata. Message bodies are discarded immediately.
 */
export function extractMetadataFromRtsMessages(messages: RtsMessage[]): TeamActivityMetadata {
  const events: ActivityEvent[] = []

  for (const msg of messages) {
    if (!msg.message_ts) continue
    const channel = msg.channel_id ?? msg.channel_name ?? 'unknown'
    events.push({
      timestamp: new Date(Number.parseFloat(msg.message_ts) * 1000).toISOString(),
      channel,
    })
  }

  const channelCounts: Record<string, number> = {}
  let afterHoursCount = 0

  for (const event of events) {
    channelCounts[event.channel] = (channelCounts[event.channel] ?? 0) + 1
    if (isAfterHours(event.timestamp)) afterHoursCount++
  }

  const recent = filterByDays(events, 0, 7)
  const prior = filterByDays(events, 7, 14)

  return {
    events,
    totalMessages: events.length,
    channelCounts,
    afterHoursCount,
    recentWeekCount: recent.length,
    priorWeekCount: prior.length,
    activeChannelsRecent: [...new Set(recent.map((e) => e.channel))],
    activeChannelsPrior: [...new Set(prior.map((e) => e.channel))],
  }
}
