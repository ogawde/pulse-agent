import { neon } from '@neondatabase/serverless';

/**
 * Fetch latest team health snapshots from Neon.
 * @param {string} [slackTeamId] - optional workspace filter
 * @returns {Promise<{ teams: Array<{ name: string, compositeScore: number, level: string, signals: Record<string, number> }>, openAlerts: number }>}
 */
export async function getTeamHealthSummary(slackTeamId) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { teams: [], openAlerts: 0 };
  }

  const sql = neon(databaseUrl);

  async function fetchTeams(filterByWorkspace) {
    if (filterByWorkspace && slackTeamId) {
      return sql`
        SELECT DISTINCT ON (t.name)
          t.name,
          s.composite_score,
          s.level,
          s.sentiment_drift,
          s.after_hours,
          s.channel_exclusion,
          s.response_drop
        FROM teams t
        JOIN workspaces w ON w.id = t.workspace_id
        JOIN signal_snapshots s ON s.team_id = t.id
        WHERE w.slack_team_id = ${slackTeamId}
        ORDER BY t.name, s.scored_at DESC
      `;
    }

    return sql`
      SELECT DISTINCT ON (t.name)
        t.name,
        s.composite_score,
        s.level,
        s.sentiment_drift,
        s.after_hours,
        s.channel_exclusion,
        s.response_drop
      FROM teams t
      JOIN signal_snapshots s ON s.team_id = t.id
      ORDER BY t.name, s.scored_at DESC
    `;
  }

  async function fetchOpenAlerts(filterByWorkspace) {
    if (filterByWorkspace && slackTeamId) {
      return sql`
        SELECT COUNT(*)::int AS count
        FROM alerts a
        JOIN teams t ON t.id = a.team_id
        JOIN workspaces w ON w.id = t.workspace_id
        WHERE a.status = 'open' AND w.slack_team_id = ${slackTeamId}
      `;
    }

    return sql`
      SELECT COUNT(*)::int AS count
      FROM alerts WHERE status = 'open'
    `;
  }

  let teams = await fetchTeams(true);
  let alertRows = await fetchOpenAlerts(true);

  // Fall back to demo data when sandbox workspace is not seeded yet
  if (teams.length === 0 && slackTeamId) {
    teams = await fetchTeams(false);
    alertRows = await fetchOpenAlerts(false);
  }

  return {
    teams: teams.map((row) => ({
      name: row.name,
      compositeScore: Number(row.composite_score),
      level: row.level,
      signals: {
        sentiment_drift: Number(row.sentiment_drift),
        after_hours: Number(row.after_hours),
        channel_exclusion: Number(row.channel_exclusion),
        response_drop: Number(row.response_drop),
      },
    })),
    openAlerts: alertRows[0]?.count ?? 0,
  };
}
