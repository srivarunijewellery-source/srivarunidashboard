import { COLORS } from '@/lib/theme'

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '32px 32px 24px' }}>
      <div>
        <h1 className="font-display" style={{ fontSize: 24, color: COLORS.ink, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
