/**
 * Neon query bridge for pulse-agent (mirrors lib/db/queries.ts).
 * Requires `tsx` to resolve TypeScript imports.
 */
export {
  acknowledgeAlert,
  getOpenAlerts,
  getTeamSummary,
} from '../../lib/db/queries.ts';
