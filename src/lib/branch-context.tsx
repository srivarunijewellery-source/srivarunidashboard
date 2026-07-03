'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

type BranchContextType = {
  branches: string[]
  selectedBranch: string | null   // null = All Branches (Consolidated)
  setSelectedBranch: (b: string | null) => void
}

const BranchContext = createContext<BranchContextType>({ branches: [], selectedBranch: null, setSelectedBranch: () => {} })

/**
 * There's only one branch today, but this makes every page branch-aware
 * ahead of the second branch launching — no page rewrites needed then,
 * just pick the branch from the dropdown. Branch IDs are discovered live
 * from the `sales` table rather than hardcoded, so a new branch shows up
 * automatically once it starts syncing data.
 */
export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('sales').select('branch_id').limit(2000).then(({ data }) => {
      const ids = [...new Set((data || []).map((r: any) => String(r.branch_id)).filter(Boolean))].sort()
      setBranches(ids)
    })
  }, [])

  return <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch }}>{children}</BranchContext.Provider>
}

export function useBranch() {
  return useContext(BranchContext)
}
