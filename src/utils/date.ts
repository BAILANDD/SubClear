export function today(): Date {
  return new Date()
}

export function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function daysAgo(n: number): string {
  return daysFromNow(-n)
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  const ms = db.getTime() - da.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function daysUntil(dateStr: string): number {
  return daysBetween(today().toISOString().split('T')[0], dateStr)
}

export function isWithinDays(dateStr: string, days: number): boolean {
  const d = daysUntil(dateStr)
  return d >= 0 && d <= days
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}
