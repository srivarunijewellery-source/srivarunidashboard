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
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    // Fetch EVERY batch for this item — not just one — so the popup can
    // show exactly which batches make up the total, and the total itself
    // is computed transparently in front of the person, not hidden.
    supabase.from('inventory_with_cost').select('*').eq('item_code', itemCode)
      .order('qty', { ascending: false }).then(({ data }) => {
        if (active) { setBatches(data || []); setLoading(false) }
      })
    return () => { active = false }
  }, [itemCode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const stocked = batches.filter(b => (b.qty ?? 0) > 0)
  const totalQty = batches.reduce((s, b) => s + (b.qty ?? 0), 0)
  const totalValue = batches.reduce((s, b) => s + (b.stock_value ?? (b.cost_per_unit ?? 0) * (b.qty ?? 0)), 0)
  const item = batches[0]

  const productName = hint?.product_name || item?.product_name
  const category = hint?.category || item?.category
  const brand = hint?.brand || item?.brand
  const mrp = hint?.mrp || item?.mrp || 0
  const cost = hint?.landing_cost || item?.cost_per_unit || 0
  const imageUrl = item?.image_url || hint?.image_url

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,46,0.55)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '85vh', overflow: 'hidden', display:'flex', flexDirection:'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: '#3b0764', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink:0 }}>
          <h3 className="font-display" style={{ color: '#fff', margin: 0, fontSize: 16 }}>Product Detail</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Loading…</div>
        ) : batches.length===0 && !hint ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Product not found ({itemCode}).</div>
        ) : (
          <div style={{ padding: 20, overflow:'auto' }}>
            <HoverImage src={imageUrl} alt={productName}
              wrapperStyle={{ width: '100%', aspectRatio: '1', borderRadius: 12, marginBottom: 16 }}
              style={{ width: '100%', height: '100%', borderRadius: 12 }} previewSize={340} />
            <p style={{ fontSize: 10, color: '#6b5b7b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{category}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 8px' }}>{productName}</p>
            <p style={{ fontSize: 12, color: '#6b5b7b', margin: '0 0 4px' }}>{brand}</p>
            <p style={{ fontSize: 11, color: '#6b5b7b', fontFamily:'monospace', margin: '0 0 12px' }}>Barcode: {itemCode}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: stocked.length>0 ? 16 : 0 }}>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>MRP</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{mrp > 0 ? fmt_inr(mrp) : '—'}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>Avg Cost/Unit</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{cost > 0 ? fmt_inr(cost) : '—'}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>In Stock (all batches)</p><p style={{ fontSize: 14, fontWeight: 700, color: totalQty <= 3 ? '#dc2626' : '#059669', margin: '2px 0 0' }}>{totalQty}</p></div>
              <div style={{ background: '#f5f0e8', borderRadius: 10, padding: '8px 12px' }}><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0 }}>Stock Value</p><p style={{ fontSize: 14, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{totalValue > 0 ? fmt_inr(totalValue) : '—'}</p></div>
            </div>

            {stocked.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3b0764', margin: '0 0 6px' }}>
                  Batch Breakdown {stocked.length > 1 ? `(${stocked.length} batches with stock)` : ''}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Batch No', 'Qty', 'Cost/Unit', 'Value'].map(h => (
                        <th key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase', background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', textAlign: h==='Batch No'?'left':'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocked.map((b, i) => (
                      <tr key={b.batch_no || i} style={{ background: i%2===0?'#fff':'#faf8ff' }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 10, borderBottom: '1px solid #f0e8d8' }}>{b.batch_no || '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #f0e8d8' }}>{b.qty}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: '#6b5b7b', borderBottom: '1px solid #f0e8d8' }}>{(b.cost_per_unit ?? 0) > 0 ? fmt_inr(b.cost_per_unit) : '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f0e8d8' }}>{(b.stock_value ?? 0) > 0 ? fmt_inr(b.stock_value) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
