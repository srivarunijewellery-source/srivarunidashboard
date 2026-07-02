'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_pct } from '@/lib/utils'
import { format } from 'date-fns'
import { X } from 'lucide-react'

export default function OrderModal({ voucherNo, onClose }: { voucherNo: string; onClose: () => void }) {
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase.from('sales').select('*').eq('voucher_no', voucherNo).limit(200).then(({ data }) => {
      if (active) { setLines(data || []); setLoading(false) }
    })
    return () => { active = false }
  }, [voucherNo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totalAmount = lines.reduce((s, l) => s + (l.net_amount || 0), 0)
  const totalProfit = lines.reduce((s, l) => s + (l.profit || 0), 0)
  const totalQty = lines.reduce((s, l) => s + (l.qty || 0), 0)
  const totalDisc = lines.reduce((s, l) => s + (l.other_discount || 0), 0)
  const first = lines[0]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,46,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 900, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: '#3b0764', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h3 className="font-display" style={{ color: '#fff', margin: 0, fontSize: 18 }}>Order {voucherNo}</h3>
            {first && (
              <p style={{ color: '#c4b5fd', fontSize: 12, margin: '4px 0 0' }}>
                {format(new Date(first.date), 'dd MMM yyyy')} · {first.customer_name || 'Walk-in'}{first.mobile_no ? ` · ${first.mobile_no}` : ''} · {first.sales_man || ''}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#6b5b7b' }}>Loading order…</div>
        ) : lines.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#6b5b7b' }}>No line items found for this order.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '16px 24px', background: '#f5f0e8', flexShrink: 0 }}>
              <div><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Line Items</p><p style={{ fontSize: 17, fontWeight: 700, color: '#3b0764', margin: '2px 0 0' }}>{lines.length}</p></div>
              <div><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qty</p><p style={{ fontSize: 17, fontWeight: 700, color: '#3b0764', margin: '2px 0 0' }}>{totalQty}</p></div>
              <div><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</p><p style={{ fontSize: 17, fontWeight: 700, color: '#3b0764', margin: '2px 0 0' }}>{fmt_inr(totalAmount)}</p></div>
              <div><p style={{ fontSize: 10, color: '#6b5b7b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Profit{totalDisc > 0 ? ` · Disc ${fmt_inr(totalDisc)}` : ''}</p><p style={{ fontSize: 17, fontWeight: 700, color: '#059669', margin: '2px 0 0' }}>{fmt_inr(totalProfit)}</p></div>
            </div>
            <div style={{ overflow: 'auto', padding: '0 24px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
                <thead>
                  <tr>
                    {['Barcode', 'Product', 'Category', 'Brand', 'Qty', 'Cost', 'Sold At', 'Margin'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase', letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', textAlign: h === 'Qty' || h === 'Cost' || h === 'Sold At' || h === 'Margin' ? 'right' : 'left', position: 'sticky', top: 0 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const m = l.net_amount > 0 ? (l.profit || 0) / l.net_amount * 100 : 0
                    return (
                      <tr key={`${l.item_code}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#faf8ff' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 10, color: '#6b5b7b', borderBottom: '1px solid #f0e8d8' }}>{l.item_code}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid #f0e8d8' }}>{l.product_name}</td>
                        <td style={{ padding: '8px 10px', color: '#6b5b7b', borderBottom: '1px solid #f0e8d8' }}>{l.category}</td>
                        <td style={{ padding: '8px 10px', color: '#6b5b7b', borderBottom: '1px solid #f0e8d8' }}>{l.brand}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #f0e8d8' }}>{l.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#6b5b7b', borderBottom: '1px solid #f0e8d8' }}>{fmt_inr(l.landing_cost)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f0e8d8' }}>{fmt_inr(l.net_amount)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: m >= 40 ? '#059669' : m >= 25 ? '#d97706' : '#dc2626', borderBottom: '1px solid #f0e8d8' }}>{fmt_pct(m)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
