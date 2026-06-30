# Pulse

Team health pulse checks for People Ops. Slack-native HR wellbeing agent for the **Slack Agent for Good** hackathon track.

**Bot:** `@Pulse` | **Slash command:** `/pulse` | **Tagline:** Team health pulse checks, not surveillance.

## Stack

- Slack Agent (Bolt + OpenAI Agents SDK) in `pulse-agent/`
- Neon PostgreSQL via Drizzle ORM in `lib/db/`
- Scoring logic (reused from Ember) in `lib/scoring/`
- MCP + RTS integration (Phase 3–4)

## Quick start

### 1. Environment

```bash
cp .env.example .env
# Set DATABASE_URL (Neon pooled), OPENROUTER_API_KEY, Slack tokens
```

### 2. Database

```bash
npm install
npm run db:push      # apply schema to Neon
npm run db:seed      # demo team snapshots (no raw messages)
```

### 3. Slack agent

```bash
cd pulse-agent
npm install
slack run            # or: npm start
```

### 4. Sandbox setup

1. Install `@Pulse` in your developer sandbox
2. Create channels: `#people-ops`, `#engineering`, `#design`
3. `/invite @Pulse` in each channel
4. Try `/pulse health` or DM `@Pulse`

## Project layout

```
pulse-agent/          Slack Bolt agent (@Pulse, /pulse)
lib/db/               Drizzle schema + Neon client
lib/scoring/          Team signal scoring (from Ember)
slack-hackathon/      Hackathon docs and migration plan
drizzle/              SQL migrations
```

## Docs

Read `slack-hackathon/START_HERE.md` and `slack-hackathon/docs/MIGRATION_PLAN.md` for build phases.

## Phase status

- [x] Phase 1: Agent shell, `/pulse health`, Block Kit intro
- [x] Phase 2: Neon schema + demo seed
- [ ] Phase 3: MCP server tools
- [ ] Phase 4: Real-Time Search integration
- [ ] Phase 5: Proactive `#people-ops` alerts
