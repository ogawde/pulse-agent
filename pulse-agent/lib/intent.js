/**
 * Detect structured Pulse queries that should return Block Kit (not free-form LLM).
 * @param {string} text
 * @returns {{ type: 'team_summary', team: string } | { type: 'open_alerts' } | null}
 */
export function parsePulseIntent(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  if (
    /open alerts?/.test(lower) ||
    /what alerts/.test(lower) ||
    /any alerts/.test(lower) ||
    /show alerts/.test(lower)
  ) {
    return { type: 'open_alerts' };
  }

  const teamMatch =
    trimmed.match(/how is (.+?) doing/i) ||
    trimmed.match(/how(?:'s| is) (.+?) (?:this week|today|looking)/i) ||
    trimmed.match(/(?:team|department)\s+(.+?)(?:\?|$)/i) ||
    trimmed.match(/status of (.+?)(?:\?|$)/i);

  if (teamMatch?.[1]) {
    const team = teamMatch[1].replace(/\?+$/, '').trim();
    if (team.length > 0 && !/^(the|our|my)\s+team$/i.test(team)) {
      return { type: 'team_summary', team };
    }
  }

  return null;
}
