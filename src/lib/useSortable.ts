'use client'
import { useState, useMemo, useCallback } from 'react'

export type SortDir = 'asc' | 'desc'

/**
 * Generic click-to-sort for any array of rows. Clicking a column calls
 * toggleSort(key) — first click sorts highest-to-lowest (desc), a second
 * click on the same column flips to lowest-to-highest (asc), matching the
 * "sort by highest vs lowest" behaviour requested everywhere.
 */
export function useSortable<T>(
  data: T[],
  getValue: (item: T, key: string) => number | string | null | undefined,
) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = getValue(a, sortKey)
      const bv = getValue(b, sortKey)
      let cmp: number
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      } else {
        cmp = (av ?? 0) as number - ((bv ?? 0) as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, getValue])

  const toggleSort = useCallback((key: string) => {
    setSortKey(prevKey => {
      if (prevKey === key) { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); return key }
      setSortDir('desc')
      return key
    })
  }, [])

  return { sorted, sortKey, sortDir, toggleSort }
}
