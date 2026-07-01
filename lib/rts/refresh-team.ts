import type { WebClient } from '@slack/web-api'

import { getTeamBaselineChannelIds, getTeamSummary, insertTeamSnapshot } from '../db/queries.js'
import { scoreTeamFromMetadata } from '../scoring/metadata.js'

import { resolveChannelIdsByName } from './channels.js'
import { isTeamOptedIn, teamChannelSlugs } from './constants.js'
import { extractMetadataFromRtsMessages } from './metadata.js'
import { searchTeamChannelContext } from './search.js'

export type RtsRefreshResult = {
  summary: Awaited<ReturnType<typeof getTeamSummary>>
  liveRefresh: boolean
  messageCount: number
  channelSlugs: string[]
}

/**
 * Refresh a team snapshot from live RTS data.
 * Derives metadata only (counts, timing, participation) — no message text stored.
 */
export async function refreshTeamSnapshotFromRts(
  client: WebClient,
  options: {
    teamName: string
    actionToken?: string
    userToken?: string
  },
): Promise<RtsRefreshResult | null> {
  if (!isTeamOptedIn(options.teamName)) {
    return null
  }

  const { messages, channelSlugs, usedLiveSearch } = await searchTeamChannelContext(client, options)
  if (messages.length === 0) {
    return null
  }

  const metadata = extractMetadataFromRtsMessages(messages)
  if (metadata.totalMessages === 0) {
    return null
  }

  let baselineChannelIds = await getTeamBaselineChannelIds(options.teamName)

  if (baselineChannelIds.length === 0 || baselineChannelIds[0]?.startsWith('C_')) {
    const resolved = await resolveChannelIdsByName(client, teamChannelSlugs(options.teamName))
    if (resolved.length > 0) {
      baselineChannelIds = resolved
    }
  }

  const scored = scoreTeamFromMetadata(metadata, { baselineChannelIds })
  if (!scored) {
    return null
  }

  await insertTeamSnapshot(options.teamName, {
    sentimentDrift: scored.sentimentDrift,
    afterHours: scored.afterHours,
    channelExclusion: scored.channelExclusion,
    responseDrop: scored.responseDrop,
    compositeScore: scored.compositeScore,
    level: scored.level,
  })

  const summary = await getTeamSummary(options.teamName)

  return {
    summary,
    liveRefresh: usedLiveSearch,
    messageCount: scored.messageCount,
    channelSlugs,
  }
}
