export function computeCompositeRisk(
  signals: {
    sentimentDrift: number
    afterHours: number
    channelExclusion: number
    responseDrop: number
  },
  options?: { earlyData?: boolean }
): { score: number; level: 'normal' | 'watch' | 'warning' | 'critical' } {
  const weights = options?.earlyData
    ? {
        sentimentDrift: 0.6,
        afterHours: 0.15,
        channelExclusion: 0.15,
        responseDrop: 0.1,
      }
    : {
        sentimentDrift: 0.4,
        afterHours: 0.2,
        channelExclusion: 0.25,
        responseDrop: 0.15,
      }
  const score =
    signals.sentimentDrift * weights.sentimentDrift +
    signals.afterHours * weights.afterHours +
    signals.channelExclusion * weights.channelExclusion +
    signals.responseDrop * weights.responseDrop

  const rounded = Math.round(score * 10) / 10
  const level =
    rounded >= 7.5 ? 'critical' : rounded >= 5 ? 'warning' : rounded >= 3 ? 'watch' : 'normal'

  return { score: rounded, level }
}
