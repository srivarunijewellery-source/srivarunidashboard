import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function fmt_inr(val: number): string {
  if (!val || isNaN(val)) return '—'
  return '₹' + Math.round(val).toLocaleString('en-IN')
}
export function fmt_pct(val: number): string {
  if (!val || isNaN(val)) return '—'
  return val.toFixed(1) + '%'
}
export function fmt_num(val: number): string {
  if (!val || isNaN(val)) return '0'
  return val.toLocaleString('en-IN')
}

export type Grain = 'day' | 'week' | 'month' | 'quarter'

// DATA_START = earliest date in the database
export const DATA_START = '2025-12-31'

export function getPeriods(grain: Grain, n: number): { from: string; to: string; label: string }[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const idx = n - 1 - i
    if (grain === 'day') {
      const d = subDays(now, idx)
      return { from: format(d, 'yyyy-MM-dd'), to: format(d, 'yyyy-MM-dd'), label: format(d, 'dd MMM') }
    }
    if (grain === 'week') {
      const start = startOfWeek(subWeeks(now, idx), { weekStartsOn: 1 })
      const end = endOfWeek(start, { weekStartsOn: 1 })
      return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd'), label: format(start, 'dd MMM') }
    }
    if (grain === 'month') {
      const d = subMonths(now, idx)
      return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMM yy') }
    }
    // quarter
    const totalMonths = now.getFullYear() * 12 + now.getMonth() - idx * 3
    const y = Math.floor(totalMonths / 12)
    const m = totalMonths % 12
    const qs = new Date(y, Math.floor(m / 3) * 3, 1)
    const qe = new Date(qs.getFullYear(), qs.getMonth() + 3, 0)
    return { from: format(qs, 'yyyy-MM-dd'), to: format(qe, 'yyyy-MM-dd'), label: `Q${Math.floor(qs.getMonth()/3)+1} ${qs.getFullYear()}` }
  })
}

// Get all months from DATA_START to now
export function getAllMonths(): { from: string; to: string; label: string }[] {
  const start = new Date(DATA_START)
  const now = new Date()
  const months: { from: string; to: string; label: string }[] = []
  let cur = startOfMonth(start)
  while (cur <= now) {
    months.push({ from: format(cur, 'yyyy-MM-dd'), to: format(endOfMonth(cur), 'yyyy-MM-dd'), label: format(cur, 'MMM yy') })
    cur = subMonths(cur, -1)
  }
  return months
}

export function getAgeInDays(dateStr: string): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function getAgeBadge(days: number) {
  if (days <= 30)  return { label: `${days}d`, color: 'bg-emerald-100 text-emerald-700' }
  if (days <= 60)  return { label: `${days}d`, color: 'bg-amber-100 text-amber-700' }
  if (days <= 90)  return { label: `${days}d`, color: 'bg-orange-100 text-orange-700' }
  return { label: `${days}d`, color: 'bg-red-100 text-red-700' }
}

// Date range for a specific month/year selection
export function getDateRange(grain: Grain, offset = 0) {
  const now = new Date()
  if (grain === 'day') {
    const d = subDays(now, offset)
    return { from: format(d, 'yyyy-MM-dd'), to: format(d, 'yyyy-MM-dd'), label: format(d, 'dd MMM yyyy') }
  }
  if (grain === 'week') {
    const start = startOfWeek(subWeeks(now, offset), { weekStartsOn: 1 })
    const end = endOfWeek(start, { weekStartsOn: 1 })
    return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd'), label: `Week of ${format(start, 'dd MMM')}` }
  }
  if (grain === 'month') {
    const d = subMonths(now, offset)
    return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMM yyyy') }
  }
  const totalM = now.getFullYear() * 12 + now.getMonth() - offset * 3
  const y = Math.floor(totalM / 12)
  const m = totalM % 12
  const qs = new Date(y, Math.floor(m / 3) * 3, 1)
  const qe = new Date(qs.getFullYear(), qs.getMonth() + 3, 0)
  return { from: format(qs, 'yyyy-MM-dd'), to: format(qe, 'yyyy-MM-dd'), label: `Q${Math.floor(qs.getMonth()/3)+1} ${qs.getFullYear()}` }
}
