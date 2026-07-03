'use client'
import { useState, useRef } from 'react'

/**
 * An image that shows a large floating preview near the cursor on hover —
 * used everywhere a product image appears (cards, table thumbnails, popups)
 * so hover-to-enlarge behaves consistently across the whole app.
 */
export default function HoverImage({
  src, alt, style, wrapperStyle, emoji = '💍', previewSize = 300, className,
}: {
  src?: string; alt?: string; style?: React.CSSProperties; wrapperStyle?: React.CSSProperties
  emoji?: string; previewSize?: number; className?: string
}) {
  const [hover, setHover] = useState(false)
  const [err, setErr] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)

  const updatePos = () => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceRight = window.innerWidth - rect.right
    const x = spaceRight > previewSize + 24 ? rect.right + 12 : Math.max(8, rect.left - previewSize - 12)
    let y = rect.top
    if (y + previewSize > window.innerHeight) y = Math.max(8, window.innerHeight - previewSize - 8)
    setPos({ x, y })
  }

  if (!src || err) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0e8', fontSize: 24, ...style }}>{emoji}</div>
    )
  }

  return (
    <div ref={wrapRef} onMouseEnter={() => { updatePos(); setHover(true) }} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', cursor: 'zoom-in', ...wrapperStyle }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt || ''} className={className} onError={() => setErr(true)} style={{ objectFit: 'cover', ...style }} />
      {hover && (
        <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 300, width: previewSize, height: previewSize, borderRadius: 16, overflow: 'hidden', border: '3px solid #fff', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', background: '#f5f0e8', pointerEvents: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
    </div>
  )
}
