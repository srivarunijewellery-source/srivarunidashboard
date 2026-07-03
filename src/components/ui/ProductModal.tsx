'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr } from '@/lib/utils'
import { X } from 'lucide-react'
import HoverImage from './HoverImage'

export default function ProductModal({ itemCode, onClose }: { itemCode: string; onClose: () => void }) {
  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase.from('inventory_with_cost').select('*').eq('item_code', itemCode).limit(1).then(({ data }) => {
      if (active) { setItem(data?.[0] || null); setLoading(false) }
    })
    return () => { active = false }
  }, [itemCode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,46,0.55)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: '#3b0764', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="font-display" style={{ color: '#fff', margin: 0, fontSize: 16 }}>Product Detail</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Loading…</div>
        ) : !item ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Product not found ({itemCode}).</div>
        ) : (
          <div style={{ padding: 20 }}>
            <HoverImage src={item.image_url} alt={item.product_name}
              wrapperStyle={{ width: '100%', aspectRatio: '1', borderRadius: 12, marginBottom: 16 }}
              style={{ width: '100%', height: '100%', borderRadius: 12 }} previewSize={340} />
            <p style={{ fontSize: 10, color: '#6b5b7b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{item.category}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 8px' }}>{item.product_name}</p>
            <p style={{ fontSize: 12, color: '#6b5b7b', margin: '0 0 12px' }}>{item.brand}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>MRP</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{fmt_inr(item.mrp)}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>Cost/Unit</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{fmt_inr(item.cost_per_unit)}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>In Stock</p><p style={{ fontSize: 14, fontWeight: 700, color: item.qty <= 3 ? '#dc2626' : '#059669', margin: '2px 0 0' }}>{item.qty}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>Stock Value</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{item.stock_value > 0 ? fmt_inr(item.stock_value) : '—'}</p></div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#6b5b7b', fontFamily: 'monospace' }}>Barcode: {item.item_code}</div>
          </div>
        )}
      </div>
    </div>
  )
}
