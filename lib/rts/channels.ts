import type { WebClient } from '@slack/web-api'

/**
 * Resolve channel slugs to Slack channel IDs via conversations.list.
 * Defaults to public channels only (no groups:read scope required).
 */
export async function resolveChannelIdsByName(
  client: WebClient,
  channelSlugs: string[],
  options?: { types?: string },
): Promise<string[]> {
  const wanted = new Set(channelSlugs.map((s) => s.toLowerCase().replace(/^#/, '')))
  const ids: string[] = []
  const types = options?.types ?? 'public_channel'

  let cursor: string | undefined
  do {
    const response = await client.conversations.list({
      types,
      exclude_archived: true,
      limit: 200,
      cursor,
    })

    if (!response.ok) {
      console.warn('conversations.list failed:', response.error)
      break
    }

    for (const ch of response.channels ?? []) {
      const name = ch.name?.toLowerCase()
      if (name && wanted.has(name) && ch.id) {
        ids.push(ch.id)
      }
    }

    cursor = response.response_metadata?.next_cursor || undefined
  } while (cursor)

  return ids
}
