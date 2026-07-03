import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, subDays, subWeeks, subMonths, subYears, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'

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

/**
 * Parse a date-only string (e.g. "2026-01-01", or an ISO timestamp with a
 * time component) as a LOCAL calendar date, not a UTC instant.
 *
 * `new Date("2026-01-01")` is parsed as UTC midnight. When that's later
 * formatted with date-fns' `format()` (which always renders in the
 * viewer's LOCAL timezone), anyone west of UTC — including all of the US —
 * sees it roll back to the previous day. Every date coming out of the
 * `sales`, `expenses`, etc. tables is a plain calendar date with no real
 * time component, so it should always be parsed as a LOCAL date instead.
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const datePart = dateStr.split('T')[0]
  const [y, m, d] = datePart.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export type Grain = 'day' | 'week' | 'month' | 'quarter' | 'year'

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
    if (grain === 'year') {
      const d = subYears(now, idx)
      return { from: format(startOfYear(d), 'yyyy-MM-dd'), to: format(endOfYear(d), 'yyyy-MM-dd'), label: format(d, 'yyyy') }
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
  const start = parseDate(DATA_START)
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
  // Clamped at 0 — a viewer far west of IST (e.g. US timezones) can see an
  // item "synced today" as still being in their own local future for a few
  // hours, which would otherwise compute as a negative age.
  return Math.max(0, Math.floor((Date.now() - parseDate(dateStr).getTime()) / 86400000))
}

export function getAgeBadge(days: number) {
  if (days <= 30)  return { label: `${days}d`, color: 'bg-emerald-100 text-emerald-700' }
  if (days <= 60)  return { label: `${days}d`, color: 'bg-amber-100 text-amber-700' }
  if (days <= 90)  return { label: `${days}d`, color: 'bg-orange-100 text-orange-700' }
  return { label: `${days}d`, color: 'bg-red-100 text-red-700' }
}

// Date range for a specific period/offset selection (offset = periods back from now)
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
  if (grain === 'year') {
    const d = subYears(now, offset)
    return { from: format(startOfYear(d), 'yyyy-MM-dd'), to: format(endOfYear(d), 'yyyy-MM-dd'), label: format(d, 'yyyy') }
  }
  const totalM = now.getFullYear() * 12 + now.getMonth() - offset * 3
  const y = Math.floor(totalM / 12)
  const m = totalM % 12
  const qs = new Date(y, Math.floor(m / 3) * 3, 1)
  const qe = new Date(qs.getFullYear(), qs.getMonth() + 3, 0)
  return { from: format(qs, 'yyyy-MM-dd'), to: format(qe, 'yyyy-MM-dd'), label: `Q${Math.floor(qs.getMonth()/3)+1} ${qs.getFullYear()}` }
}


// ── Category rationalization ────────────────────────────────────────────
// The ERP has accumulated near-duplicate category spellings over time
// (case variants, typos, phonetic spelling differences) — e.g. "BANGLE" vs
// "bangles", "mang tika" vs "Maang Tikka", "Short Haram" vs "Short
// Necklace". This maps known duplicates to one canonical display name;
// anything not explicitly listed just gets consistent title-casing.
const CATEGORY_ALIASES: Record<string, string> = {
  'bags': 'Bags', 'BAGS': 'Bags',
  'BANGLE': 'Bangles', 'bangles': 'Bangles',
  'mang tika': 'Maang Tikka', 'Maang Tikka': 'Maang Tikka',
  'PATILU': 'Patilu', 'PATTILU': 'Patilu',
  'Short Haram': 'Short Necklace', 'short haram': 'Short Necklace', 'Short Necklace': 'Short Necklace',
  'lear neck set': 'Layer Neck Set', '2 lear neck set': 'Layer Neck Set',
  'lear chain': 'Layer Chain',
  'pendent': 'Pendant',
  'neckset': 'Neck Set',
  'nosering': 'Nose Ring',
}
const CATEGORY_ALIASES_LOWER: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_ALIASES).map(([k, v]) => [k.toLowerCase(), v])
)

function titleCase(s: string): string {
  return s.toLowerCase().split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

export function normalizeCategory(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'Other'
  const trimmed = raw.trim()
  const alias = CATEGORY_ALIASES_LOWER[trimmed.toLowerCase()]
  if (alias) return alias
  return titleCase(trimmed)
}

/**
 * Groups a list of raw category strings (as they actually appear in the
 * database) by their normalized/canonical name, so a dropdown can show
 * "Bangles" once while a query filter can still match every raw spelling
 * variant ("BANGLE", "bangles", ...) that rolls up to it.
 */
export function buildCategoryGroups(rawCategories: (string | null | undefined)[]): { canonical: string; raws: string[] }[] {
  const map: Record<string, Set<string>> = {}
  for (const raw of rawCategories) {
    if (!raw) continue
    const canon = normalizeCategory(raw)
    if (!map[canon]) map[canon] = new Set()
    map[canon].add(raw)
  }
  return Object.entries(map)
    .map(([canonical, raws]) => ({ canonical, raws: [...raws] }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical))
}
