'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import type { Grain } from './utils'

const STORAGE_KEY = 'sv-date-range'

type DateRangeContextType = {
  grain: Grain
  offset: number
  setGrain: (g: Grain) => void
  setOffset: (updater: number | ((o: number) => number)) => void
}

const DateRangeContext = createContext<DateRangeContextType>({
  grain: 'month', offset: 0, setGrain: () => {}, setOffset: () => {},
})

/**
 * Shared day/week/month/quarter/year selection used by the DateNav filter
 * across Overview, Sales, Team, Customers, and Inventory's category cut —
 * picking a period on one page keeps it selected everywhere else, and it
 * survives a full page refresh via localStorage (a plain React context
 * alone resets on refresh; this doesn't).
 */
export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [grain, setGrainState] = useState<Grain>('month')
  const [offset, setOffsetState] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.grain) setGrainState(parsed.grain)
        if (typeof parsed.offset === 'number') setOffsetState(parsed.offset)
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ grain, offset })) } catch {}
  }, [grain, offset, hydrated])

  const setGrain = (g: Grain) => { setGrainState(g); setOffsetState(0) }
  const setOffset = (updater: number | ((o: number) => number)) => {
    setOffsetState(prev => typeof updater === 'function' ? (updater as (o: number) => number)(prev) : updater)
  }

  return <DateRangeContext.Provider value={{ grain, offset, setGrain, setOffset }}>{children}</DateRangeContext.Provider>
}

export function useDateRange() {
  return useContext(DateRangeContext)
}
