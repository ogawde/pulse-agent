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

function formatSignalLabel(signal) {
  return signal.replace(/_/g, ' ');
}

/**
 * Build Block Kit for a single team summary (PITCH primary flow).
 * @param {import('../../lib/pulse-data.js').TeamSummary | object} summary
 * @param {{ id: string, title: string, severity: string } | null} [teamAlert]
 * @param {{ liveRefresh?: boolean, rtsMeta?: { messageCount: number, channelSlugs: string[] } }} [options]
 * @returns {import('@slack/types').KnownBlock[]}
 */
export function buildTeamSummaryBlocks(summary, teamAlert = null, options = {}) {
  const emoji = LEVEL_EMOJI[summary.level] ?? ':white_circle:';
  const driverLines =
    summary.activeSignals?.length > 0
      ? summary.activeSignals.map((s) => `• ${formatSignalLabel(s)}`).join('\n')
      : '• No elevated signals right now';

  /** @type {import('@slack/types').KnownBlock[]} */
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${summary.team} — ${summary.level.charAt(0).toUpperCase()}${summary.level.slice(1)}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Composite score:* ${summary.compositeScore.toFixed(1)} / 10\n` + `*Drivers:*\n${driverLines}`,
      },
    },
  ];

  if (teamAlert) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *Open alert:* ${teamAlert.title} (${teamAlert.severity})`,
      },
    });
  }

  /** @type {import('@slack/types').ActionsBlock['elements']} */
  const actionElements = [
    {
      type: 'button',
      action_id: 'pulse_suggest_checkin',
      text: { type: 'plain_text', text: 'Suggest check-in' },
      value: summary.team,
    },
  ];

  if (teamAlert) {
    actionElements.unshift({
      type: 'button',
      action_id: 'pulse_acknowledge_alert',
      text: { type: 'plain_text', text: 'Acknowledge' },
      style: 'primary',
      value: teamAlert.id,
    });
  }

  blocks.push({ type: 'actions', elements: actionElements });

  const contextParts = ['Aggregate team-level insights via Pulse MCP. No individual rankings.'];
  if (options.liveRefresh && options.rtsMeta) {
    const channels = options.rtsMeta.channelSlugs.map((s) => `#${s}`).join(', ');
    contextParts.push(
      `Live RTS refresh from ${channels} (${options.rtsMeta.messageCount} messages analyzed, metadata only).`,
    );
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: contextParts.join(' '),
      },
    ],
  });

  return blocks;
}

/**
 * Build Block Kit for open alerts list.
 * @param {Array<{ id: string, team: string, title: string, summary: string, severity: string, signalDrivers: string[] }>} alerts
 * @returns {import('@slack/types').KnownBlock[]}
 */
export function buildOpenAlertsBlocks(alerts) {
  if (alerts.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: No open alerts right now. Teams look stable.',
        },
      },
    ];
  }

  /** @type {import('@slack/types').KnownBlock[]} */
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Open Alerts (${alerts.length})` },
    },
  ];

  for (const alert of alerts) {
    const drivers = alert.signalDrivers?.map((d) => formatSignalLabel(d)).join(', ') || 'elevated signals';
    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*${alert.team}* — ${alert.title}\n` +
            `${alert.summary}\n` +
            `_Drivers:_ ${drivers} · _Severity:_ ${alert.severity}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'pulse_acknowledge_alert',
            text: { type: 'plain_text', text: 'Acknowledge' },
            style: 'primary',
            value: alert.id,
          },
        ],
      },
    );
  }

  return blocks;
}

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
