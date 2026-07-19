/**
 * Drop-in replacement for a raw `<div style={{ overflow:'auto' }}>` (or
 * overflowX) around a wide table. Desktop behavior is identical — the
 * difference is iOS momentum scrolling and a visible left/right scroll
 * hint gradient on mobile, so a horizontally-scrollable table doesn't just
 * look cut off with no indication it scrolls. See .table-scroll in
 * globals.css.
 */
export default function TableScroll({ children, style, maxHeight }: {
  children: React.ReactNode
  style?: React.CSSProperties
  maxHeight?: number | string
}) {
  return (
    <div className="table-scroll" style={{ overflow: 'auto', maxHeight, ...style }}>
      {children}
    </div>
  )
}
