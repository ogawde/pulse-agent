export type ProactiveAlert = {
  id: string
  team: string
  title: string
  summary: string
  severity: string
  signalDrivers: string[]
}

function formatDriver(signal: string): string {
  return signal.replace(/_/g, ' ')
}

/**
 * Block Kit for a proactive #people-ops alert post.
 */
export function buildProactiveAlertBlocks(alert: ProactiveAlert) {
  const drivers =
    alert.signalDrivers?.map(formatDriver).join(', ') || 'elevated team signals'

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Pulse Team Health Alert',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `:warning: *${alert.team}* — ${alert.title}\n` +
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
        {
          type: 'button',
          action_id: 'pulse_suggest_checkin',
          text: { type: 'plain_text', text: 'Suggest check-in' },
          value: alert.team,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Proactive aggregate alert from Pulse. No individual rankings.',
        },
      ],
    },
  ]
}
