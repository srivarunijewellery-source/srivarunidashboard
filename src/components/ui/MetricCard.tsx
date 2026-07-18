'use client'
interface MetricCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'purple' | 'green' | 'amber' | 'red' | 'beige'
  delta?: { value: string; positive: boolean }
  onClick?: () => void
}

// NOTE: the 'purple' key name is kept as-is even though the palette moved to
// garnet/rose — every page calls <MetricCard accent="purple"> and renaming
// the key would mean touching every call site across the app for no visual
// benefit. Only the hex value changed.
const borderColors = {
  purple: '#b76e79', green: '#10b981', amber: '#f59e0b', red: '#ef4444', beige: '#ecd9d3'
}
const deltaColors = { true: '#059669', false: '#dc2626' }

export default function MetricCard({ label, value, sub, accent = 'purple', delta, onClick }: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 14, padding: '16px 20px',
        borderLeft: `4px solid ${borderColors[accent]}`,
        boxShadow: '0 2px 8px rgba(92,26,43,0.07)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(92,26,43,0.18)' } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(92,26,43,0.07)' } }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, color: '#8f6b64', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#2b1013', margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#8f6b64', marginTop: 2 }}>{sub}</p>}
      {delta && (
        <p style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: deltaColors[String(delta.positive) as keyof typeof deltaColors] }}>
          {delta.positive ? '▲' : '▼'} {delta.value}
        </p>
      )}
    </div>
  )
}
