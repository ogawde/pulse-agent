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

## CAPABILITIES
- Answer questions like "How is Engineering doing?" with team health context
- Summarize open alerts and suggested next steps
- Use /pulse health for a quick workspace summary

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

export const pulseAgent = new Agent({
  name: 'Pulse',
  instructions: SYSTEM_PROMPT,
  tools: [addEmojiReaction],
  model: getOpenRouterModel(),
});

/** @deprecated Use pulseAgent */
export const starterAgent = pulseAgent;

/**
 * Run the Pulse agent, optionally connecting to the Slack MCP server.
 * @param {string | import('@openai/agents').AgentInputItem[]} inputItems
 * @param {import('./deps.js').AgentDeps} deps
 * @returns {Promise<import('@openai/agents').RunResult<any, any>>}
 */
export async function runAgent(inputItems, deps) {
  if (deps.userToken) {
    const mcpServer = new MCPServerStreamableHttp({
      url: SLACK_MCP_URL,
      requestInit: { headers: { Authorization: `Bearer ${deps.userToken}` } },
    });

    try {
      await mcpServer.connect();
      const agentWithMcp = pulseAgent.clone({ mcpServers: [mcpServer] });
      return await run(agentWithMcp, inputItems, { context: deps });
    } finally {
      await mcpServer.close();
    }
  }

  return await run(pulseAgent, inputItems, { context: deps });
}
