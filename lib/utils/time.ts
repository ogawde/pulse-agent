/** True if timestamp falls outside typical weekday work hours (UTC, simplified). */
export function isAfterHours(timestamp: string | Date): boolean {
  const date = new Date(timestamp)
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return true
  const hour = date.getUTCHours()
  return hour < 9 || hour >= 18
}
