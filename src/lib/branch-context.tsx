'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const STORAGE_KEY = 'sv-selected-branch'

type BranchContextType = {
  branches: string[]
  selectedBranch: string | null   // null = All Branches (Consolidated)
  setSelectedBranch: (b: string | null) => void
}

const BranchContext = createContext<BranchContextType>({ branches: [], selectedBranch: null, setSelectedBranch: () => {} })

/**
 * There's only one branch today, but this makes every page branch-aware
 * ahead of the second branch launching. Branch IDs are discovered live from
 * the `sales` table rather than hardcoded. Selection persists across page
 * navigation and refresh via localStorage.
 */
export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranchState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    supabase.from('sales').select('branch_id').limit(2000).then(({ data }) => {
      const ids = [...new Set((data || []).map((r: any) => String(r.branch_id)).filter(Boolean))].sort()
      setBranches(ids)
    })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw !== null) setSelectedBranchState(raw === 'null' ? null : raw)
    } catch {}
    setHydrated(true)
  }, [])

  const setSelectedBranch = (b: string | null) => {
    setSelectedBranchState(b)
    if (hydrated) { try { localStorage.setItem(STORAGE_KEY, b === null ? 'null' : b) } catch {} }
  }

  return <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch }}>{children}</BranchContext.Provider>
}

export function useBranch() {
  return useContext(BranchContext)
}
