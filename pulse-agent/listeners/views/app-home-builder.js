/**
 * Build the Pulse App Home Block Kit view.
 * @param {string | null} [installUrl] - OAuth install URL shown when MCP is disconnected.
 * @param {boolean} [isConnected] - Whether the Slack MCP Server is connected.
 * @returns {import('@slack/types').HomeView}
 */
export function buildAppHomeView(installUrl = null, isConnected = false) {
  /** @type {import('@slack/types').KnownBlock[]} */
  const blocks = [
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
          'Pulse helps People Ops spot team-level stress early with aggregate wellbeing signals.\n\n' +
          '*Get started*\n' +
          '• `/pulse health` — workspace team health summary\n' +
          '• DM or @mention `@Pulse` — ask about a specific team\n' +
          '• Open alerts post to `#people-ops`',
      },
    },
    { type: 'divider' },
  ];

  if (isConnected) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':large_green_circle: *Slack MCP Server is connected.*',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Pulse can search channels and gather live workspace context via RTS.',
          },
        ],
      },
    );
  } else if (installUrl) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:red_circle: *Slack MCP Server is disconnected.* <${installUrl}|Connect the Slack MCP Server.>`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Connect MCP to enable live workspace search and richer team health answers.',
          },
        ],
      },
    );
  } else {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Aggregate team-level insights only. No employee leaderboards. No raw message archives.',
        },
      ],
    });
  }

  return { type: 'home', blocks };
}
