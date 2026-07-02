interface MetricCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'purple' | 'green' | 'amber' | 'red' | 'beige'
  delta?: { value: string; positive: boolean }
}

const borderColors = {
  purple: '#7c3aed', green: '#10b981', amber: '#f59e0b', red: '#ef4444', beige: '#e8d5b7'
}
const deltaColors = { true: '#059669', false: '#dc2626' }

export default function MetricCard({ label, value, sub, accent = 'purple', delta }: MetricCardProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 20px',
      borderLeft: `4px solid ${borderColors[accent]}`,
      boxShadow: '0 2px 8px rgba(59,7,100,0.07)'
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#1a0a2e', margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#6b5b7b', marginTop: 2 }}>{sub}</p>}
      {delta && (
        <p style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: deltaColors[String(delta.positive) as keyof typeof deltaColors] }}>
          {delta.positive ? '▲' : '▼'} {delta.value}
        </p>
      )}
    </div>
  )
}
