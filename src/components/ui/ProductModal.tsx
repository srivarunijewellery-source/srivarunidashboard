'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr } from '@/lib/utils'
import { X } from 'lucide-react'
import HoverImage from './HoverImage'

export type ProductHint = Partial<{
  product_name: string; category: string; brand: string
  mrp: number; landing_cost: number; image_url: string
}>

export default function ProductModal({ itemCode, hint, onClose }: { itemCode: string; hint?: ProductHint; onClose: () => void }) {
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    // Prefer the batch with stock (and therefore real mrp/cost data) over an
    // empty/zeroed-out batch row, which is what a plain .limit(1) could grab.
    supabase.from('inventory_with_cost').select('*').eq('item_code', itemCode)
      .order('qty', { ascending: false }).limit(1).then(({ data }) => {
        if (active) { setItem(data?.[0] || null); setLoading(false) }
      })
    return () => { active = false }
  }, [itemCode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Values the caller already knows (e.g. the exact card/row the person
  // clicked) win over a fresh, possibly different-batch DB lookup — this is
  // what keeps the popup consistent with whatever screen it was opened from.
  const productName = hint?.product_name || item?.product_name
  const category = hint?.category || item?.category
  const brand = hint?.brand || item?.brand
  const mrp = hint?.mrp || item?.mrp || 0
  const cost = hint?.landing_cost || item?.cost_per_unit || 0
  const imageUrl = item?.image_url || hint?.image_url

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,46,0.55)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: '#3b0764', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="font-display" style={{ color: '#fff', margin: 0, fontSize: 16 }}>Product Detail</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Loading…</div>
        ) : !item && !hint ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Product not found ({itemCode}).</div>
        ) : (
          <div style={{ padding: 20 }}>
            <HoverImage src={imageUrl} alt={productName}
              wrapperStyle={{ width: '100%', aspectRatio: '1', borderRadius: 12, marginBottom: 16 }}
              style={{ width: '100%', height: '100%', borderRadius: 12 }} previewSize={340} />
            <p style={{ fontSize: 10, color: '#6b5b7b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{category}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 8px' }}>{productName}</p>
            <p style={{ fontSize: 12, color: '#6b5b7b', margin: '0 0 12px' }}>{brand}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>MRP</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{mrp > 0 ? fmt_inr(mrp) : '—'}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>Cost/Unit</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{cost > 0 ? fmt_inr(cost) : '—'}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>In Stock</p><p style={{ fontSize: 14, fontWeight: 700, color: (item?.qty ?? 0) <= 3 ? '#dc2626' : '#059669', margin: '2px 0 0' }}>{item?.qty ?? '—'}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>Stock Value</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{item?.stock_value > 0 ? fmt_inr(item.stock_value) : '—'}</p></div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#6b5b7b', fontFamily: 'monospace' }}>Barcode: {itemCode}</div>
            {!item && <p style={{ marginTop: 10, fontSize: 11, color: '#d97706' }}>No current stock record for this item — showing details from the sale itself.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
