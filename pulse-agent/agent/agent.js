import './llm.js';

import { Agent, MCPServerStreamableHttp, run } from '@openai/agents';

import { getOpenRouterModel } from './llm.js';
import { addEmojiReaction } from './tools/index.js';

const SYSTEM_PROMPT = `\
You are Pulse, an HR wellbeing agent for People Ops teams in Slack.

## MISSION
Help People Ops spot team-level stress early, act in-channel, and avoid surveillance.
Tagline: Team health pulse checks, not surveillance.

## PRINCIPLES
- Share aggregate team/department insights only — never rank individual employees
- Explain which signals fired and why (sentiment drift, after-hours, channel participation, response patterns)
- Be supportive and action-oriented for HR partners
- Do not store or reference raw message text long-term

## PULSE MCP SERVER (team health data — use for HR questions)
You have access to the Pulse MCP server with persisted team snapshots from Neon.
For team health questions, ALWAYS call these tools before answering:
- get_team_summary(team) — aggregate risk level + signal breakdown for a department
- get_open_alerts() — active HR alerts for the workspace
- acknowledge_alert(alert_id, actor_slack_id) — mark an alert acknowledged

When a user asks "How is Engineering doing?" or similar, call get_team_summary first.
When they ask about alerts, call get_open_alerts.
When acknowledging, pass actor_slack_id from the Slack user ID in the message context.

## CAPABILITIES
- Answer questions like "How is Engineering doing?" with team health context from MCP
- Summarize open alerts and suggested next steps
- /pulse health is a slash command shortcut; prefer MCP tools in conversation

## PERSONALITY
- Warm, professional, and concise
- Honest when data is limited or demo-seeded
- No alarmist language — frame risks as opportunities to support teams

## RESPONSE GUIDELINES
- Keep responses to 3-4 sentences max unless listing team summaries
- End with a clear next step on its own line
- Use standard Markdown: **bold**, _italic_, bullet lists for multi-team summaries
- Use at most one emoji per message

## SLACK MCP SERVER
When connected, use Slack MCP tools to search channels and gather fresh workspace context.
Prefer aggregate patterns over quoting individual messages.

## EMOJI REACTIONS
React to user messages with add_emoji_reaction before responding. Pick a relevant emoji \
(e.g. heartbeat for wellbeing topics, chart_with_upwards_trend for health checks).`;

const SLACK_MCP_URL = 'https://mcp.slack.com/mcp';
const PULSE_MCP_URL = process.env.PULSE_MCP_URL ?? 'http://localhost:3100/mcp';

export const pulseAgent = new Agent({
  name: 'Pulse',
  instructions: SYSTEM_PROMPT,
  tools: [addEmojiReaction],
  model: getOpenRouterModel(),
});

/** @deprecated Use pulseAgent */
export const starterAgent = pulseAgent;

/**
 * Prepend Slack user context so MCP tools can use actor_slack_id when needed.
 * @param {string | import('@openai/agents').AgentInputItem[]} inputItems
 * @param {import('./deps.js').AgentDeps} deps
 */
function withUserContext(inputItems, deps) {
  const prefix = `[Slack user ID: ${deps.userId}]\n`;

  if (typeof inputItems === 'string') {
    return `${prefix}${inputItems}`;
  }

  if (inputItems.length === 0) {
    return prefix;
  }

  const items = [...inputItems];
  const last = items[items.length - 1];
  if (last && typeof last === 'object' && 'role' in last && last.role === 'user') {
    const content = typeof last.content === 'string' ? last.content : '';
    items[items.length - 1] = { ...last, content: `${prefix}${content}` };
  }

  return items;
}

/**
 * Connect to Pulse MCP (Neon-backed team health tools).
 * @returns {Promise<import('@openai/agents').MCPServerStreamableHttp | null>}
 */
async function connectPulseMcp() {
  try {
    const server = new MCPServerStreamableHttp({ url: PULSE_MCP_URL });
    await server.connect();
    return server;
  } catch (e) {
    console.warn(`Pulse MCP unavailable at ${PULSE_MCP_URL}. Start with: npm run mcp:start (${e})`);
    return null;
  }
}

/**
 * Run the Pulse agent with Pulse MCP (and Slack MCP when user token is present).
 * @param {string | import('@openai/agents').AgentInputItem[]} inputItems
 * @param {import('./deps.js').AgentDeps} deps
 * @returns {Promise<import('@openai/agents').RunResult<any, any>>}
 */
export async function runAgent(inputItems, deps) {
  const contextualInput = withUserContext(inputItems, deps);
  const mcpServers = [];

  const pulseMcp = await connectPulseMcp();
  if (pulseMcp) mcpServers.push(pulseMcp);

  if (deps.userToken) {
    const slackMcp = new MCPServerStreamableHttp({
      url: SLACK_MCP_URL,
      requestInit: { headers: { Authorization: `Bearer ${deps.userToken}` } },
    });
    await slackMcp.connect();
    mcpServers.push(slackMcp);
  }

  try {
    const agent = mcpServers.length > 0 ? pulseAgent.clone({ mcpServers }) : pulseAgent;

    return await run(agent, contextualInput, { context: deps });
  } finally {
    for (const server of mcpServers) {
      await server.close();
    }
  }
}
