const LEVEL_EMOJI = {
  normal: ':large_green_circle:',
  watch: ':large_yellow_circle:',
  warning: ':large_orange_circle:',
  critical: ':red_circle:',
};

/**
 * Pulse intro Block Kit card shown on first contact or /pulse help.
 * @returns {import('@slack/types').KnownBlock[]}
 */
export function buildPulseIntroBlocks() {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Pulse — Team health pulse checks',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*Team health pulse checks, not surveillance.*\n\n' +
          'Pulse helps People Ops spot team-level stress early using aggregate signals. ' +
          'No employee leaderboards. No long-term message archives.',
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*How to use Pulse*\n' +
          '• `/pulse health` — workspace team health summary\n' +
          '• `/pulse help` — show this card again\n' +
          '• DM or @mention `@Pulse` — ask about a team (e.g. "How is Engineering doing?")',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Signals: sentiment drift, after-hours activity, channel participation, response patterns',
        },
      ],
    },
  ];
}

/**
 * Format a team health row for Block Kit.
 * @param {{ name: string, compositeScore: number, level: string }} team
 * @returns {string}
 */
function formatTeamRow(team) {
  const emoji = LEVEL_EMOJI[team.level] ?? ':white_circle:';
  return `${emoji} *${team.name}* — score ${team.compositeScore.toFixed(1)} (${team.level})`;
}

/**
 * Build team health summary blocks from DB data.
 * @param {{ teams: Array<{ name: string, compositeScore: number, level: string, signals?: Record<string, number> }>, openAlerts: number }} data
 * @returns {import('@slack/types').KnownBlock[]}
 */
export function buildHealthSummaryBlocks(data) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Team Health Summary',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${data.openAlerts}* open alert${data.openAlerts === 1 ? '' : 's'} across the workspace.`,
      },
    },
    { type: 'divider' },
  ];

  if (data.teams.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          'No team snapshots yet. Run `npm run db:seed` to load demo data, ' +
          'or ask `@Pulse` about a team once RTS is connected.',
      },
    });
    return blocks;
  }

  const teamLines = data.teams.map(formatTeamRow).join('\n');
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: teamLines,
    },
  });

  const flagged = data.teams.filter((t) => t.level !== 'normal');
  if (flagged.length > 0) {
    const detail = flagged
      .map((t) => {
        const signals = t.signals
          ? Object.entries(t.signals)
              .filter(([, v]) => v >= 3)
              .map(([k]) => k.replace(/_/g, ' '))
              .join(', ')
          : '';
        return `*${t.name}*: ${signals || 'elevated composite score'}`;
      })
      .join('\n');

    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Active signals*\n${detail}`,
        },
      },
    );
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Aggregate team-level insights only. Ask `@Pulse` for details on a specific team.',
      },
    ],
  });

  return blocks;
}
