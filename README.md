# Pulse

Team health pulse checks for People Ops. Slack-native HR wellbeing agent for the **Slack Agent for Good** hackathon track.

**Bot:** `@Pulse` | **Slash command:** `/pulse` | **Tagline:** Team health pulse checks, not surveillance.

## Stack

- Slack Agent (Bolt + OpenAI Agents SDK) in `pulse-agent/`
- **Pulse MCP server** in `mcp/` (Neon-backed team health tools)
- Neon PostgreSQL via Drizzle ORM in `lib/db/`
- Scoring logic (reused from Ember) in `lib/scoring/`
- RTS integration (Phase 4)

## Quick start

### 1. Environment

```bash
cp .env.example .env
# Set DATABASE_URL (Neon pooled), OPENROUTER_API_KEY
```

### 2. Database

```bash
npm install
npm run db:push      # apply schema to Neon
npm run db:seed      # demo team snapshots (no raw messages)
```

### 3. Run Pulse (two terminals)

**Terminal 1** — MCP server (repo root):

```bash
npm run mcp:start
```

**Terminal 2** — Slack agent:

```bash
cd pulse-agent
npm install
slack run
```

### 4. Sandbox setup

1. Install `@Pulse` in your developer sandbox
2. Create channels: `#people-ops`, `#engineering`, `#design`
3. `/invite @Pulse` in each channel
4. Try `/pulse health` or DM `@Pulse`: *How is Engineering doing?*

## MCP tools

See [`mcp/README.md`](mcp/README.md) for tool details and architecture.

| Tool | Use when |
|------|----------|
| `get_team_summary(team)` | "How is Engineering doing?" |
| `get_open_alerts()` | "What alerts are open?" |
| `acknowledge_alert(alert_id, actor_slack_id)` | HR acknowledges an alert |

## Project layout

```
pulse-agent/          Slack Bolt agent (@Pulse, /pulse)
mcp/                  Pulse MCP server (Streamable HTTP)
lib/db/               Drizzle schema, queries, Neon client
lib/scoring/          Team signal scoring (from Ember)
drizzle/              SQL migrations
```

## Phase status

- [x] Phase 1: Agent shell, `/pulse health`, Block Kit intro
- [x] Phase 2: Neon schema + demo seed
- [x] Phase 3: MCP server + agent wiring
- [ ] Phase 4: Real-Time Search integration
- [ ] Phase 5: Proactive `#people-ops` alerts
