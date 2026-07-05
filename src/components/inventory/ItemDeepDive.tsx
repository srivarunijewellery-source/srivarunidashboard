'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchVendorMap } from '@/lib/supabase'
import { fmt_inr, fmt_num, normalizeCategory, parseDate, vasyErpProductUrl } from '@/lib/utils'
import HoverImage from '@/components/ui/HoverImage'
import OrderModal from '@/components/ui/OrderModal'
import { Search, ExternalLink, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'8px 10px', fontSize:10, fontWeight:700, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'6px 10px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8', whiteSpace:'nowrap' as const },
}

// Flags rows that share every field except a synced_at-style noise field --
// i.e. likely re-sync duplicates -- purely for visual transparency here.
// Does NOT affect any calculation; computed_inventory already handles
// real deduplication at the data level.
function flagDuplicates<T extends Record<string, any>>(rows: T[], keyFields: string[]): (T & { _dup?: boolean })[] {
  const seen = new Set<string>()
  return rows.map(r => {
    const key = keyFields.map(f => r[f]).join('|')
    const isDup = seen.has(key)
    seen.add(key)
    return { ...r, _dup: isDup }
  })
}

export default function ItemDeepDive() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [vendor, setVendor] = useState('')

  const [inward, setInward] = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [orderVoucher, setOrderVoucher] = useState<string|null>(null)

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('computed_inventory')
        .select('item_code,product_name,category,brand,qty')
        .or(`item_code.ilike.%${query}%,product_name.ilike.%${query}%`)
        .limit(10)
      setSuggestions(data || [])
      setShowSuggestions(true)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const loadItem = async (itemCode: string) => {
    setShowSuggestions(false)
    setLoading(true)
    try {
      const [ci, mi, sa, sl, pu, vm] = await Promise.all([
        supabase.from('computed_inventory').select('*').eq('item_code', itemCode).maybeSingle(),
        supabase.from('material_inward').select('inward_date,inward_qty,supplier_name,po_no,inward_no').eq('item_code', itemCode).order('inward_date', { ascending: false }),
        supabase.from('stock_adjustments').select('created_on,transaction_date,type,batch_no,in_qty,out_qty,adjusted_qty').eq('item_code', itemCode).order('created_on', { ascending: false }),
        supabase.from('sales').select('date,voucher_no,qty,net_amount,selling_price,customer_name,mobile_no,sales_man').eq('item_code', itemCode).order('date', { ascending: false }),
        supabase.from('purchases').select('bill_date,voucher_no,supplier_name,rate,qty,inward_no').eq('item_code', itemCode).order('bill_date', { ascending: false }),
        fetchVendorMap([itemCode]),
      ])
      setSelected(ci.data)
      setInward(mi.data || [])
      setAdjustments(flagDuplicates(sa.data || [], ['batch_no','type','in_qty','out_qty','adjusted_qty','created_on']))
      setSales(sl.data || [])
      setPurchases(pu.data || [])
      setVendor(vm[itemCode] || '')
      setQuery(itemCode)
    } finally { setLoading(false) }
  }

  const rateByInwardNo = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of purchases) if (p.inward_no && p.rate > 0) map[p.inward_no] = p.rate
    return map
  }, [purchases])

  const erpUrl = selected ? vasyErpProductUrl(selected.product_id) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Item Deep Dive</h2>
        <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Search a barcode or product name to see every log for that item — inward, adjustments, sales, and purchases.</p>
      </div>

      <div style={{ position:'relative', maxWidth:480 }}>
        <div style={{ position:'relative' }}>
          <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#6b5b7b' }}/>
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>suggestions.length>0 && setShowSuggestions(true)}
            placeholder="Search barcode or product name..."
            style={{ width:'100%', padding:'12px 14px 12px 40px', borderRadius:12, border:'1px solid #e8d5b7', background:'#fff', fontSize:14, color:'#1a0a2e', outline:'none' }}/>
        </div>
        {showSuggestions && suggestions.length>0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#fff', border:'1px solid #e8d5b7', borderRadius:12, boxShadow:'0 8px 32px rgba(59,7,100,0.16)', zIndex:20, maxHeight:300, overflow:'auto' }}>
            {suggestions.map(s=>(
              <button key={s.item_code} onClick={()=>loadItem(s.item_code)}
                style={{ width:'100%', textAlign:'left', padding:'10px 16px', fontSize:13, background:'none', border:'none', cursor:'pointer', borderBottom:'1px solid #f0e8d8', color:'#1a0a2e', display:'flex', justifyContent:'space-between' }}>
                <span><strong>{s.item_code}</strong> — {s.product_name?.slice(0,40)}</span>
                <span style={{ color:'#6b5b7b' }}>{s.qty} in stock</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>}

      {!loading && selected && (
        <>
          <div style={{ ...S.section, padding:20, display:'flex', gap:16 }}>
            <HoverImage src={selected.image_url} alt={selected.product_name} previewSize={280}
              wrapperStyle={{ width:100, height:100, borderRadius:12, border:'1px solid #e8d5b7', flexShrink:0 }}
              style={{ width:100, height:100, borderRadius:12 }}/>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:10, color:'#6b5b7b', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5, margin:0 }}>{normalizeCategory(selected.category)}</p>
              <p onClick={()=>erpUrl && window.open(erpUrl,'_blank','noopener,noreferrer')} style={{ fontSize:16, fontWeight:700, color: erpUrl?'#3b0764':'#1a0a2e', margin:'2px 0 4px', cursor:erpUrl?'pointer':'default', textDecoration:erpUrl?'underline':'none', textDecorationColor:'#c4b5fd' }}>{selected.product_name}</p>
              <p style={{ fontSize:12, color:'#6b5b7b', margin:0 }}>{selected.brand} {vendor && `· Vendor: ${vendor}`}</p>
              <p style={{ fontSize:11, color:'#6b5b7b', fontFamily:'monospace', margin:'4px 0 0' }}>{selected.item_code}</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignContent:'start' }}>
              <div style={{ background:'#f5f0e8', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
                <p style={{ fontSize:10, color:'#6b5b7b', margin:0 }}>In Stock</p>
                <p style={{ fontSize:18, fontWeight:700, color: selected.qty<=3?'#dc2626':'#059669', margin:'2px 0 0' }}>{selected.qty}</p>
              </div>
              <div style={{ background:'#f5f0e8', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
                <p style={{ fontSize:10, color:'#6b5b7b', margin:0 }}>Stock Value</p>
                <p style={{ fontSize:18, fontWeight:700, color:'#1a0a2e', margin:'2px 0 0' }}>{selected.stock_value>0?fmt_inr(selected.stock_value):'—'}</p>
              </div>
            </div>
          </div>

          {/* Material Inward */}
          <div style={S.section}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8d5b7' }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'#059669', margin:0 }}>Material Inward ({inward.length})</h3>
            </div>
            {inward.length===0 ? <p style={{ padding:16, fontSize:12, color:'#6b5b7b', fontStyle:'italic', margin:0 }}>No inward records.</p> : (
              <div style={{ overflow:'auto', maxHeight:280 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr>{['Date','Qty','Vendor','Rate/Unit','Inward #','PO #'].map(h=><th key={h} style={{...S.th,position:'sticky',top:0}}>{h}</th>)}</tr></thead>
                  <tbody>{inward.map((r,i)=>(
                    <tr key={i} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={S.td}>{r.inward_date?format(parseDate(r.inward_date),'dd MMM yyyy'):'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>+{r.inward_qty}</td>
                      <td style={S.td}>{r.supplier_name||'—'}</td>
                      <td style={{ ...S.td, textAlign:'right' }}>{rateByInwardNo[r.inward_no]?fmt_inr(rateByInwardNo[r.inward_no]):'—'}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10 }}>{r.inward_no}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10 }}>{r.po_no||'—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stock Adjustments */}
          <div style={S.section}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8d5b7' }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'#d97706', margin:0 }}>Stock Adjustments ({adjustments.length})</h3>
              <p style={{ fontSize:11, color:'#6b5b7b', margin:'2px 0 0' }}>Raw log, unfiltered · rows flagged ⚠ look like exact duplicates (informational only, doesn't affect the stock total)</p>
            </div>
            {adjustments.length===0 ? <p style={{ padding:16, fontSize:12, color:'#6b5b7b', fontStyle:'italic', margin:0 }}>No adjustment records.</p> : (
              <div style={{ overflow:'auto', maxHeight:280 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr>{['','Created','Type','Batch','In','Out','Net'].map(h=><th key={h} style={{...S.th,position:'sticky',top:0}}>{h}</th>)}</tr></thead>
                  <tbody>{adjustments.map((r,i)=>(
                    <tr key={i} style={{ background: r._dup?'#fef2f2':(i%2===0?'#fff':'#faf8ff') }}>
                      <td style={S.td}>{r._dup && <AlertTriangle size={12} color="#dc2626"/>}</td>
                      <td style={S.td}>{r.created_on?format(new Date(r.created_on),'dd MMM yyyy HH:mm'):'—'}</td>
                      <td style={S.td}>{r.type}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10 }}>{r.batch_no||'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#059669' }}>{r.in_qty>0?`+${r.in_qty}`:'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#dc2626' }}>{r.out_qty>0?`-${r.out_qty}`:'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{r.adjusted_qty>0?`+${r.adjusted_qty}`:r.adjusted_qty}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sales */}
          <div style={S.section}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8d5b7' }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'#7c3aed', margin:0 }}>Sales ({sales.length})</h3>
            </div>
            {sales.length===0 ? <p style={{ padding:16, fontSize:12, color:'#6b5b7b', fontStyle:'italic', margin:0 }}>Never sold.</p> : (
              <div style={{ overflow:'auto', maxHeight:280 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr>{['Date','Qty','Customer','Price/Unit','Salesperson','Bill'].map(h=><th key={h} style={{...S.th,position:'sticky',top:0}}>{h}</th>)}</tr></thead>
                  <tbody>{sales.map((r,i)=>(
                    <tr key={i} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={S.td}>{r.date?format(parseDate(r.date),'dd MMM yyyy'):'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#dc2626' }}>-{r.qty}</td>
                      <td style={S.td}>{r.customer_name||'Walk-in'}{r.mobile_no?` (${r.mobile_no})`:''}</td>
                      <td style={{ ...S.td, textAlign:'right' }}>{fmt_inr(r.selling_price||0)}</td>
                      <td style={S.td}>{r.sales_man||'—'}</td>
                      <td style={S.td}>
                        <button onClick={()=>setOrderVoucher(r.voucher_no)} style={{ background:'none', border:'none', cursor:'pointer', color:'#7c3aed', fontFamily:'monospace', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                          #{r.voucher_no}<ExternalLink size={10}/>
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          {/* Purchases */}
          <div style={S.section}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8d5b7' }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'#3b0764', margin:0 }}>Purchase Bills ({purchases.length})</h3>
            </div>
            {purchases.length===0 ? <p style={{ padding:16, fontSize:12, color:'#6b5b7b', fontStyle:'italic', margin:0 }}>No purchase records.</p> : (
              <div style={{ overflow:'auto', maxHeight:280 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr>{['Date','Vendor','Qty','Rate','Bill No','Inward #'].map(h=><th key={h} style={{...S.th,position:'sticky',top:0}}>{h}</th>)}</tr></thead>
                  <tbody>{purchases.map((r,i)=>(
                    <tr key={i} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={S.td}>{r.bill_date?format(parseDate(r.bill_date),'dd MMM yyyy'):'—'}</td>
                      <td style={S.td}>{r.supplier_name||'—'}</td>
                      <td style={{ ...S.td, textAlign:'right' }}>{r.qty}</td>
                      <td style={{ ...S.td, textAlign:'right' }}>{r.rate>0?fmt_inr(r.rate):'—'}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10 }}>{r.voucher_no}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10 }}>{r.inward_no||'—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !selected && query.length>=2 && !showSuggestions && (
        <p style={{ fontSize:13, color:'#6b5b7b', textAlign:'center', padding:24 }}>No matching item found.</p>
      )}

      {orderVoucher && <OrderModal voucherNo={orderVoucher} onClose={()=>setOrderVoucher(null)}/>}
    </div>
  )
}
