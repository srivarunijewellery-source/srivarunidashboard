'use client'
import type { Grain } from '@/lib/utils'

const grains: { value: Grain; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
]

export default function GrainSelector({ value, onChange, options }: { value: Grain; onChange: (g: Grain) => void; options?: Grain[] }) {
  const items = options ? grains.filter(g => options.includes(g.value)) : grains
  return (
    <div style={{ display: 'inline-flex', background: '#f0e8d8', borderRadius: 10, padding: 3, border: '1px solid #e8d5b7' }}>
      {items.map(g => (
        <button key={g.value} onClick={() => onChange(g.value)} style={{
          padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          background: value === g.value ? '#3b0764' : 'transparent',
          color: value === g.value ? '#fff' : '#6b5b7b',
        }}>{g.label}</button>
      ))}
    </div>
  )
}
