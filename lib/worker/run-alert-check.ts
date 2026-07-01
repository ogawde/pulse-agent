import { buildAlertDraft, shouldAlert } from '../alerts/evaluate.js'
import {
  getAllLatestTeamSummaries,
  hasOpenAlertForTeam,
  insertAlert,
  type OpenAlert,
} from '../db/queries.js'

export type CreatedAlert = OpenAlert

/**
 * Check team snapshots vs thresholds and insert new alerts in Neon.
 * Skips teams that already have an open alert.
 */
export async function runAlertCheck(): Promise<CreatedAlert[]> {
  const summaries = await getAllLatestTeamSummaries()
  const created: CreatedAlert[] = []

  for (const summary of summaries) {
    if (!shouldAlert(summary)) continue
    if (await hasOpenAlertForTeam(summary.team)) continue

    const draft = buildAlertDraft(summary)
    const alertId = await insertAlert({
      teamName: draft.team,
      severity: draft.severity,
      title: draft.title,
      summary: draft.summary,
      signalDrivers: draft.signalDrivers,
    })

    if (!alertId) continue

    created.push({
      id: alertId,
      team: draft.team,
      severity: draft.severity,
      title: draft.title,
      summary: draft.summary,
      signalDrivers: draft.signalDrivers,
      firedAt: new Date().toISOString(),
    })
  }

  return created
}
