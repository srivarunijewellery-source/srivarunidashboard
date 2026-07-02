import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt_inr(val: number): string {
  if (!val || isNaN(val)) return '—'
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 })
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

export function getDateRange(grain: Grain, offset = 0): { from: string; to: string; label: string } {
  const now = new Date()

  if (grain === 'day') {
    const d = subDays(now, offset)
    return { from: format(d, 'yyyy-MM-dd'), to: format(d, 'yyyy-MM-dd'), label: format(d, 'dd MMM yyyy') }
  }
  if (grain === 'week') {
    const start = startOfWeek(subDays(now, offset * 7), { weekStartsOn: 1 })
    const end = endOfWeek(start, { weekStartsOn: 1 })
    return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd'), label: `Week of ${format(start, 'dd MMM')}` }
  }
  if (grain === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMM yyyy') }
  }
  // quarter
  const d = new Date(now.getFullYear(), now.getMonth() - offset * 3, 1)
  return { from: format(startOfQuarter(d), 'yyyy-MM-dd'), to: format(endOfQuarter(d), 'yyyy-MM-dd'), label: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}` }
}

export function getAgeInDays(dateStr: string): number {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function getAgeBadge(days: number): { label: string; color: string } {
  if (days <= 30) return { label: `${days}d`, color: 'bg-emerald-100 text-emerald-700' }
  if (days <= 60) return { label: `${days}d`, color: 'bg-amber-100 text-amber-700' }
  if (days <= 90) return { label: `${days}d`, color: 'bg-orange-100 text-orange-700' }
  return { label: `${days}d`, color: 'bg-red-100 text-red-700' }
}
