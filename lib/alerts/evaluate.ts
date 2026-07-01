import type { TeamSummary } from '../db/queries.js'

export const ALERT_LEVELS = new Set(['watch', 'warning', 'critical'])

export type AlertDraft = {
  team: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  summary: string
  signalDrivers: string[]
}

export function shouldAlert(summary: TeamSummary): boolean {
  return ALERT_LEVELS.has(summary.level)
}

function severityFromLevel(level: string): AlertDraft['severity'] {
  if (level === 'critical') return 'critical'
  if (level === 'warning') return 'high'
  if (level === 'watch') return 'medium'
  return 'low'
}

function formatDriver(signal: string): string {
  return signal.replace(/_/g, ' ')
}

function titleForTeam(summary: TeamSummary): string {
  const label = summary.level.charAt(0).toUpperCase() + summary.level.slice(1)
  return `${summary.team} team health at ${label} level`
}

function summaryForTeam(summary: TeamSummary): string {
  const drivers = summary.activeSignals.map(formatDriver)
  if (drivers.length === 0) {
    return `${summary.team} composite score is ${summary.compositeScore.toFixed(1)}. Consider a wellbeing check-in.`
  }
  return `${summary.team} shows elevated ${drivers.join(', ')}. Composite score ${summary.compositeScore.toFixed(1)} / 10. Consider a supportive check-in.`
}

/** Build alert row content from a team snapshot. */
export function buildAlertDraft(summary: TeamSummary): AlertDraft {
  return {
    team: summary.team,
    severity: severityFromLevel(summary.level),
    title: titleForTeam(summary),
    summary: summaryForTeam(summary),
    signalDrivers: summary.activeSignals.length > 0 ? summary.activeSignals : ['composite_score'],
  }
}
