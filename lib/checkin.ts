import { createHmac } from 'crypto'

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getWeeklyToken(date?: Date): string {
  const d = date ?? new Date()
  const year = d.getFullYear()
  const week = getISOWeek(d)
  const weekStr = `${year}-W${week.toString().padStart(2, '0')}`
  const secret = process.env.CHECKIN_SECRET ?? 'aerosync-default-secret'
  return createHmac('sha256', secret).update(weekStr).digest('hex').slice(0, 16)
}

export function isValidToken(token: string): boolean {
  const now = new Date()
  const thisWeek = getWeeklyToken(now)
  // Also accept last week's token as grace period
  const lastWeek = getWeeklyToken(new Date(now.getTime() - 7 * 86400000))
  return token === thisWeek || token === lastWeek
}

export function getWeekLabel(date?: Date): string {
  const d = date ?? new Date()
  return `${d.getFullYear()}年第${getISOWeek(d)}週`
}

/** Next Monday 00:00 — when this week's QR expires */
export function getWeekExpiry(date?: Date): Date {
  const d = new Date(date ?? new Date())
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  return d
}
