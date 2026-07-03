'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GrainSelector from './GrainSelector'
import type { Grain } from '@/lib/utils'

/**
 * Shared day/week/month/quarter/year navigable filter — the same pattern
 * Inventory originally used, now reused everywhere for consistency.
 */
export default function DateNav({
  grain, onGrainChange, offset, onOffsetChange, label, grainOptions,
}: {
  grain: Grain
  onGrainChange: (g: Grain) => void
  offset: number
  onOffsetChange: (updater: (o: number) => number) => void
  label: string
  grainOptions?: Grain[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <GrainSelector value={grain} onChange={g => { onGrainChange(g); onOffsetChange(() => 0) }} options={grainOptions} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => onOffsetChange(o => o + 1)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e8d5b7', background: '#fff', cursor: 'pointer', color: '#3b0764' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a0a2e', minWidth: 140, textAlign: 'center' }}>{label}</span>
        <button onClick={() => onOffsetChange(o => Math.max(0, o - 1))} disabled={offset === 0} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e8d5b7', background: '#fff', cursor: offset === 0 ? 'default' : 'pointer', color: offset === 0 ? '#ccc' : '#3b0764' }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
