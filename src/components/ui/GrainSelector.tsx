'use client'
import { cn } from '@/lib/utils'
import type { Grain } from '@/lib/utils'

const grains: { value: Grain; label: string }[] = [
  { value: 'day',     label: 'Day' },
  { value: 'week',    label: 'Week' },
  { value: 'month',   label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
]

interface GrainSelectorProps {
  value: Grain
  onChange: (g: Grain) => void
  options?: Grain[]
}

export default function GrainSelector({ value, onChange, options }: GrainSelectorProps) {
  const items = options ? grains.filter(g => options.includes(g.value)) : grains
  return (
    <div className="inline-flex bg-sv-beige rounded-lg p-0.5 border border-sv-beige-dark">
      {items.map(g => (
        <button
          key={g.value}
          onClick={() => onChange(g.value)}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
            value === g.value
              ? 'bg-sv-purple text-white shadow-sm'
              : 'text-sv-muted hover:text-sv-ink'
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}
