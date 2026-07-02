import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'purple' | 'green' | 'amber' | 'red' | 'beige'
  delta?: { value: string; positive: boolean }
}

const accents = {
  purple: 'border-l-sv-purple-light bg-white',
  green:  'border-l-emerald-500 bg-white',
  amber:  'border-l-amber-500 bg-white',
  red:    'border-l-red-500 bg-white',
  beige:  'border-l-sv-beige-dark bg-white',
}

export default function MetricCard({ label, value, sub, accent = 'purple', delta }: MetricCardProps) {
  return (
    <div className={cn('rounded-xl border-l-4 px-5 py-4 shadow-card', accents[accent])}>
      <p className="text-xs font-medium text-sv-muted uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-sv-ink mt-1 font-body">{value}</p>
      {sub && <p className="text-xs text-sv-muted mt-0.5">{sub}</p>}
      {delta && (
        <p className={cn('text-xs font-medium mt-1', delta.positive ? 'text-emerald-600' : 'text-red-500')}>
          {delta.positive ? '▲' : '▼'} {delta.value}
        </p>
      )}
    </div>
  )
}
