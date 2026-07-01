/**
 * Teams opted in to RTS monitoring. Only these channels are queried.
 * Channel slugs match sandbox names: #engineering, #design
 */
export const OPTED_IN_TEAM_CHANNELS: Record<string, string[]> = {
  engineering: ['engineering'],
  design: ['design'],
}

/** Channel slug for a team name (e.g. "Engineering" → engineering). */
export function teamChannelSlugs(teamName: string): string[] {
  const key = teamName.trim().toLowerCase()
  if (OPTED_IN_TEAM_CHANNELS[key]) {
    return OPTED_IN_TEAM_CHANNELS[key]
  }
  return [key.replace(/\s+/g, '-')]
}

export function isTeamOptedIn(teamName: string): boolean {
  const key = teamName.trim().toLowerCase()
  return key in OPTED_IN_TEAM_CHANNELS
}
