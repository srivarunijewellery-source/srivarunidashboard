'use client'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

/** Small arrow shown in a sortable column header — inactive (both-ways),
 * or active pointing the direction currently applied. */
export default function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={11} style={{ opacity: 0.35, marginLeft: 3, verticalAlign: -1 }} />
  return dir === 'desc'
    ? <ChevronDown size={12} style={{ marginLeft: 3, verticalAlign: -1 }} />
    : <ChevronUp size={12} style={{ marginLeft: 3, verticalAlign: -1 }} />
}
