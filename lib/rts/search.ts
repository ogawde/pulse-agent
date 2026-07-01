import { WebClient } from '@slack/web-api'

import { teamChannelSlugs, isTeamOptedIn } from './constants.js'

export type RtsMessage = {
  content?: string
  message_ts?: string
  channel_id?: string
  channel_name?: string
}

export type RtsSearchResult = {
  messages: RtsMessage[]
  channelSlugs: string[]
  usedLiveSearch: boolean
}

const RTS_LOOKBACK_DAYS = 14

/**
 * Fetch recent workspace messages for opted-in team channels via Slack RTS API.
 * Message bodies may appear in the API response but are only used transiently
 * to extract timestamps and channel IDs — never persisted.
 */
export async function searchTeamChannelContext(
  client: WebClient,
  options: {
    teamName: string
    actionToken?: string
    userToken?: string
  },
): Promise<RtsSearchResult> {
  const channelSlugs = teamChannelSlugs(options.teamName)

  if (!isTeamOptedIn(options.teamName)) {
    console.warn(`Team "${options.teamName}" is not opted in to RTS monitoring`)
    return { messages: [], channelSlugs, usedLiveSearch: false }
  }

  const useUserToken = Boolean(options.userToken)
  const useBotToken = Boolean(options.actionToken)

  if (!useUserToken && !useBotToken) {
    return { messages: [], channelSlugs, usedLiveSearch: false }
  }

  const rtsClient = useUserToken ? new WebClient(options.userToken) : client
  const after = Math.floor(Date.now() / 1000) - RTS_LOOKBACK_DAYS * 86400
  const allMessages: RtsMessage[] = []
  const seen = new Set<string>()

  for (const slug of channelSlugs) {
    const payload: Record<string, unknown> = {
      query: `Recent team activity in #${slug} over the past two weeks`,
      content_types: ['messages'],
      channel_types: ['public_channel', 'private_channel'],
      limit: 25,
      after,
    }

    if (!useUserToken && options.actionToken) {
      payload.action_token = options.actionToken
    }

    const response = await rtsClient.assistant.search.context(payload)

    if (!response.ok) {
      console.warn(`RTS search failed for #${slug}:`, response.error)
      continue
    }

    const hits = (response.results?.messages ?? []) as RtsMessage[]
    for (const hit of hits) {
      const key = `${hit.channel_id ?? hit.channel_name}:${hit.message_ts}`
      if (hit.message_ts && !seen.has(key)) {
        seen.add(key)
        allMessages.push(hit)
      }
    }
  }

  return {
    messages: allMessages,
    channelSlugs,
    usedLiveSearch: allMessages.length > 0,
  }
}
