/**
 * Drop-in replacement for a raw `<div style={{ display:'grid',
 * gridTemplateColumns:'repeat(N,1fr)', gap:X }}>`. Desktop behavior is
 * identical (same column count, same gap) — the difference only shows up
 * under 768px, where it collapses to 2 columns, then 1 under 480px, via the
 * .responsive-grid rules in globals.css.
 *
 * Usage: <MetricGrid cols={6} gap={14}>...cards...</MetricGrid>
 */
export default function MetricGrid({ cols, gap = 16, children, style }: {
  cols: number
  gap?: number
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      className="responsive-grid"
      style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gap, ...style }}
    >
      {children}
    </div>
  )
}
