import type { WebClient } from '@slack/web-api'

const PEOPLE_OPS_SLUG = 'people-ops'

/**
 * Resolve #people-ops channel ID (env override, slash-command hint, or public channel lookup).
 */
export async function resolvePeopleOpsChannelId(
  client: WebClient,
  hintChannelId?: string,
): Promise<string | null> {
  const fromEnv = process.env.PULSE_PEOPLE_OPS_CHANNEL_ID?.trim()
  if (fromEnv) return fromEnv

  if (hintChannelId) return hintChannelId

  const { resolveChannelIdsByName } = await import('../rts/channels.js')
  const ids = await resolveChannelIdsByName(client, [PEOPLE_OPS_SLUG], {
    types: 'public_channel',
  })
  return ids[0] ?? null
}
