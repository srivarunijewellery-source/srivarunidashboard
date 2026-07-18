'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, parseDate } from '@/lib/utils'
import { X, ShoppingBag, PackagePlus, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

// sales_unified = FTP-sourced sales for every date it covers, backfilled with
// API-sourced sales_api for anything after FTP's last successful sync.
const SALES_SOURCE = 'sales_unified'

export default function ItemHistoryModal({ itemCode, productName, onClose, onOpenOrder }: {
  itemCode: string; productName?: string; onClose: () => void; onOpenOrder?: (voucherNo: string) => void
}) {
  const [sales, setSales] = useState<any[]>([])
  const [inward, setInward] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      supabase.from(SALES_SOURCE).select('date,voucher_no,qty,net_amount,selling_price,customer_name,mobile_no,sales_man').eq('item_code', itemCode).order('date', { ascending: false }),
      supabase.from('material_inward').select('inward_date,inward_qty,supplier_name,po_no,inward_no').eq('item_code', itemCode).order('inward_date', { ascending: false }),
      // inward_amount on material_inward is the TOTAL for the whole
      // inward batch (can span 100+ different items), NOT a per-item
      // amount -- dividing it by this item's qty alone produces a
      // meaningless inflated number. purchases has inward_no directly,
      // giving a real per-line-item rate instead.
      supabase.from('purchases').select('inward_no,rate').eq('item_code', itemCode),
    ]).then(([s, m, p]) => {
      if (!active) return
      const rateByInwardNo: Record<string, number> = {}
      for (const row of (p.data || [])) { if (row.inward_no && row.rate>0) rateByInwardNo[row.inward_no] = row.rate }
      setSales(s.data || [])
      setInward((m.data || []).map(row => ({ ...row, rate: rateByInwardNo[row.inward_no] })))
      setLoading(false)
    })
    return () => { active = false }
  }, [itemCode])

  const totalSold = sales.reduce((s,r)=>s+(r.qty||0),0)
  const totalReceived = inward.reduce((s,r)=>s+(r.inward_qty||0),0)

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(26,10,46,0.55)', zIndex:160, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, maxWidth:560, width:'100%', maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background:'#3b0764', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <h3 className="font-display" style={{ color:'#fff', margin:0, fontSize:16 }}>Sale & Stock History</h3>
            <p style={{ color:'#c4b5fd', fontSize:11, margin:'2px 0 0' }}>{productName || itemCode} · {itemCode}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', padding:4, display:'flex' }}><X size={18}/></button>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#6b5b7b' }}>Loading…</div>
        ) : (
          <div style={{ padding:20, overflow:'auto', display:'flex', flexDirection:'column', gap:20 }}>

            {/* Inward history */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <PackagePlus size={14} color="#059669"/>
                <h4 style={{ fontSize:13, fontWeight:700, color:'#059669', margin:0 }}>Stock Received</h4>
                <span style={{ fontSize:11, color:'#6b5b7b' }}>({fmt_num(totalReceived)} units total)</span>
              </div>
              {inward.length===0 ? (
                <p style={{ fontSize:12, color:'#6b5b7b', fontStyle:'italic' }}>No material inward records for this item.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {inward.map((r,i)=>{
                    const rate = r.rate || 0
                    return (
                      <div key={i} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                          <span style={{ fontWeight:700, color:'#065f46' }}>+{r.inward_qty} units</span>
                          <span style={{ color:'#6b5b7b', fontSize:11 }}>{r.inward_date?format(parseDate(r.inward_date),'dd MMM yyyy'):'—'}</span>
                        </div>
                        <div style={{ color:'#1a0a2e', marginTop:2 }}>
                          From <strong>{r.supplier_name||'Unknown vendor'}</strong>
                          {rate>0 && <> at <strong>{fmt_inr(rate)}</strong>/unit</>}
                        </div>
                        <div style={{ color:'#6b5b7b', fontSize:10, marginTop:2, fontFamily:'monospace' }}>Inward #{r.inward_no} {r.po_no?`· PO ${r.po_no}`:''}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sales history */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <ShoppingBag size={14} color="#7c3aed"/>
                <h4 style={{ fontSize:13, fontWeight:700, color:'#7c3aed', margin:0 }}>Sales</h4>
                <span style={{ fontSize:11, color:'#6b5b7b' }}>({fmt_num(totalSold)} units total)</span>
              </div>
              {sales.length===0 ? (
                <p style={{ fontSize:12, color:'#6b5b7b', fontStyle:'italic' }}>This item has never been sold.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {sales.map((r,i)=>(
                    <div key={i} style={{ background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:10, padding:'8px 12px', fontSize:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                        <span style={{ fontWeight:700, color:'#5b21b6' }}>Sold {r.qty} unit{r.qty!==1?'s':''}</span>
                        <span style={{ color:'#6b5b7b', fontSize:11 }}>{r.date?format(parseDate(r.date),'dd MMM yyyy'):'—'}</span>
                      </div>
                      <div style={{ color:'#1a0a2e', marginTop:2 }}>
                        To <strong>{r.customer_name||'Walk-in'}</strong>{r.mobile_no?` (${r.mobile_no})`:''} at <strong>{fmt_inr(r.selling_price||0)}</strong>/unit
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                        <span style={{ color:'#6b5b7b', fontSize:10 }}>{r.sales_man?`Sold by ${r.sales_man}`:''}</span>
                        {onOpenOrder ? (
                          <button onClick={()=>onOpenOrder(r.voucher_no)} style={{ display:'flex', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', color:'#7c3aed', fontSize:11, fontWeight:600, fontFamily:'monospace', padding:0 }}>
                            Bill #{r.voucher_no} <ExternalLink size={10}/>
                          </button>
                        ) : (
                          <span style={{ fontSize:11, fontFamily:'monospace', color:'#7c3aed' }}>Bill #{r.voucher_no}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
