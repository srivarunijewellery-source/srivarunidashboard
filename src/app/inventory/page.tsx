'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, getDateRange, getAgeInDays, type Grain } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import GrainSelector from '@/components/ui/GrainSelector'
import MetricCard from '@/components/ui/MetricCard'
import ProductCard from '@/components/inventory/ProductCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 25
const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'10px 14px', fontSize:11, fontWeight:600, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'10px 12px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8' },
}

export default function InventoryPage() {
  const [view, setView] = useState<'sold'|'snapshot'>('sold')
  const [grain, setGrain] = useState<Grain>('day')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState(0)
  const [soldItems, setSoldItems] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ revenue:0, profit:0, qty:0, products:0 })
  const [loading, setLoading] = useState(false)
  const [pivotRows, setPivotRows] = useState<any[]>([])
  const [allBrands, setAllBrands] = useState<string[]>([])
  const [drillKey, setDrillKey] = useState<{cat:string;brand:string}|null>(null)
  const [drillItems, setDrillItems] = useState<any[]>([])
  const [snapLoading, setSnapLoading] = useState(false)

  const dateRange = getDateRange(grain, offset)

  const loadSold = useCallback(async () => {
    setLoading(true); setPage(0)
    try {
      const { data: sales } = await supabase.from('sales')
        .select('item_code,product_name,category,brand,selling_price,landing_cost,mrp,qty,net_amount,profit')
        .gte('date', dateRange.from).lte('date', dateRange.to).limit(10000)
      if (!sales?.length) { setSoldItems([]); setMetrics({revenue:0,profit:0,qty:0,products:0}); return }

      const agg: Record<string,any> = {}
      for (const s of sales) {
        if (!agg[s.item_code]) agg[s.item_code] = { ...s, qty_sold:0, revenue:0, profit:0 }
        agg[s.item_code].qty_sold += s.qty||0
        agg[s.item_code].revenue  += s.net_amount||0
        agg[s.item_code].profit   += s.profit||0
      }
      const codes = Object.keys(agg)

      // Use inventory_with_cost for stock remaining + cost_per_unit
      const { data: inv } = await supabase.from('inventory_with_cost')
        .select('item_code,image_url,qty,synced_at,cost_per_unit').in('item_code', codes.slice(0,500))

      // Vendor from purchases
      const { data: purch } = await supabase.from('purchases')
        .select('item_code,supplier_name').in('item_code', codes.slice(0,500)).limit(2000)

      const invMap: Record<string,any> = {}; for (const p of inv||[]) invMap[p.item_code] = p
      const venMap: Record<string,string> = {}; for (const p of purch||[]) { if (!venMap[p.item_code]) venMap[p.item_code] = p.supplier_name }

      const items = Object.values(agg).map(i => ({
        ...i,
        image_url:    invMap[i.item_code]?.image_url || '',
        qty_remaining: invMap[i.item_code]?.qty ?? 0,
        age_days:     invMap[i.item_code]?.synced_at ? getAgeInDays(invMap[i.item_code].synced_at) : undefined,
        vendor:       venMap[i.item_code],
        // Use sales landing_cost if available, otherwise purchases rate
        landing_cost: i.landing_cost || invMap[i.item_code]?.cost_per_unit || 0,
      })).sort((a,b) => b.revenue - a.revenue)

      setSoldItems(items)
      setMetrics({ revenue:items.reduce((s,i)=>s+i.revenue,0), profit:items.reduce((s,i)=>s+i.profit,0), qty:items.reduce((s,i)=>s+i.qty_sold,0), products:items.length })
    } finally { setLoading(false) }
  }, [dateRange.from, dateRange.to])

  const loadSnapshot = useCallback(async () => {
    setSnapLoading(true)
    try {
      // Use the view which has correct cost_per_unit from purchases
      const { data } = await supabase.from('inventory_with_cost')
        .select('item_code,category,brand,qty,mrp,cost_per_unit,stock_value').gt('qty',0).limit(10000)
      if (!data) return
      const brands = [...new Set(data.map(p=>p.brand).filter(Boolean))].sort()
      setAllBrands(brands)
      const map: Record<string,any> = {}
      for (const p of data) {
        const cat = p.category||'Other', br = p.brand||'Unknown'
        const val = p.stock_value || (p.cost_per_unit||0)*(p.qty||0)
        if (!map[cat]) map[cat] = { category:cat, total:{qty:0,value:0}, brands:{} }
        map[cat].total.qty += p.qty||0
        map[cat].total.value += val
        if (!map[cat].brands[br]) map[cat].brands[br] = { qty:0, value:0 }
        map[cat].brands[br].qty += p.qty||0
        map[cat].brands[br].value += val
      }
      setPivotRows(Object.values(map).sort((a,b)=>b.total.qty-a.total.qty))
    } finally { setSnapLoading(false) }
  }, [])

  const loadDrill = useCallback(async (cat:string, brand:string) => {
    setDrillKey({cat,brand})
    let q = supabase.from('inventory_with_cost').select('*').gt('qty',0)
    if (cat!=='ALL') q = q.eq('category',cat)
    if (brand!=='ALL') q = q.eq('brand',brand)
    const { data } = await q.order('qty',{ascending:false}).limit(1000)
    setDrillItems(data||[])
  }, [])

  useEffect(() => { if (view==='sold') loadSold(); else loadSnapshot() }, [view, loadSold, loadSnapshot])

  const pageItems = soldItems.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
  const totalPages = Math.ceil(soldItems.length/PAGE_SIZE)
  const margin = metrics.revenue>0?metrics.profit/metrics.revenue*100:0

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Inventory" subtitle="Sold items view and live stock snapshot"
        actions={
          <div style={{ display:'flex', gap:8 }}>
            {(['sold','snapshot'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
                border:`1px solid ${view===v?'#3b0764':'#e8d5b7'}`,
                background:view===v?'#3b0764':'#fff', color:view===v?'#fff':'#6b5b7b',
              }}>{v==='sold'?'📦 Sold Items':'📊 Stock Snapshot'}</button>
            ))}
          </div>
        }
      />
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:20 }}>

        {view==='sold'&&(
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <GrainSelector value={grain} onChange={g=>{setGrain(g);setOffset(0)}} />
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={()=>setOffset(o=>o+1)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', color:'#3b0764' }}>
                  <ChevronLeft size={16}/>
                </button>
                <span style={{ fontSize:13, fontWeight:600, color:'#1a0a2e', minWidth:140, textAlign:'center' }}>{dateRange.label}</span>
                <button onClick={()=>setOffset(o=>Math.max(0,o-1))} disabled={offset===0} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', cursor:offset===0?'default':'pointer', color:offset===0?'#ccc':'#3b0764' }}>
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
              <MetricCard label="Revenue" value={fmt_inr(metrics.revenue)} sub={dateRange.label} accent="purple"/>
              <MetricCard label="Profit" value={fmt_inr(metrics.profit)} sub={`${margin.toFixed(1)}% margin`} accent="green"/>
              <MetricCard label="Units Sold" value={fmt_num(metrics.qty)} accent="beige"/>
              <MetricCard label="Unique Products" value={fmt_num(metrics.products)} accent="beige"/>
            </div>

            {loading ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
                {Array.from({length:10}).map((_,i)=><div key={i} style={{ borderRadius:16, background:'#fff', aspectRatio:'3/4', border:'1px solid #e8d5b7' }}/>)}
              </div>
            ) : soldItems.length===0 ? (
              <div style={{ textAlign:'center', padding:'80px 0', color:'#6b5b7b' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>💍</div>
                <p style={{ fontSize:16, fontWeight:500 }}>No sales for {dateRange.label}</p>
              </div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
                  {pageItems.map(item=><ProductCard key={item.item_code} {...item}/>)}
                </div>
                {totalPages>1&&(
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, paddingTop:8 }}>
                    <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:13, cursor:page===0?'default':'pointer', color:page===0?'#ccc':'#3b0764' }}>← Prev</button>
                    <span style={{ fontSize:13, color:'#6b5b7b' }}>{page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,soldItems.length)} of {soldItems.length}</span>
                    <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:13, cursor:page>=totalPages-1?'default':'pointer', color:page>=totalPages-1?'#ccc':'#3b0764' }}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {view==='snapshot'&&(
          <>
            <div>
              <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Stock Snapshot — Category × Brand</h2>
              <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Click any cell for product detail · Stock value from purchase rates</p>
            </div>

            {snapLoading?<div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>:(
              <div style={S.section}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#3b0764' }}>
                        <th style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, minWidth:160 }}>Category</th>
                        <th style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'right', cursor:'pointer' }} onClick={()=>loadDrill('ALL','ALL')}>TOTAL</th>
                        {allBrands.map(b=><th key={b} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'right', minWidth:100 }}>{b}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {pivotRows.map((row,ri)=>(
                        <tr key={row.category} style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                          <td style={{ ...S.td, color:'#3b0764', fontWeight:700, position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff', cursor:'pointer' }} onClick={()=>loadDrill(row.category,'ALL')}>{row.category}</td>
                          <td style={{ ...S.td, textAlign:'right' }}>
                            <div style={{ fontWeight:700 }}>{fmt_num(row.total.qty)} units</div>
                            <div style={{ fontSize:10, color:'#6b5b7b' }}>{row.total.value>0?fmt_inr(row.total.value):'(cost N/A)'}</div>
                          </td>
                          {allBrands.map(b=>{
                            const cell=row.brands[b]
                            return (
                              <td key={b} style={{ ...S.td, textAlign:'right', cursor:cell?'pointer':'default', background:cell?undefined:'#fafafa' }} onClick={()=>cell&&loadDrill(row.category,b)}>
                                {cell?(<><div style={{ fontWeight:600 }}>{fmt_num(cell.qty)}</div><div style={{ fontSize:10, color:'#6b5b7b' }}>{cell.value>0?fmt_inr(cell.value):'—'}</div></>):<span style={{ color:'#e8d5b7' }}>—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {drillKey&&drillItems.length>0&&(
              <div style={S.section}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <h3 className="font-display" style={{ color:'#3b0764', margin:0, fontSize:15 }}>
                      {drillKey.cat==='ALL'?'All Products':drillKey.brand==='ALL'?drillKey.cat:`${drillKey.cat} — ${drillKey.brand}`}
                    </h3>
                    <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{drillItems.length} products in stock</p>
                  </div>
                  <button onClick={()=>setDrillKey(null)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:'pointer', color:'#6b5b7b' }}>Close ×</button>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr>{['Product','Category','Brand','Stock','MRP','Cost/Unit','Stock Value'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {drillItems.map((item,i)=>(
                        <tr key={item.item_code} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                          <td style={S.td}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {item.image_url&&<img src={item.image_url} alt="" style={{ width:36, height:36, borderRadius:8, objectFit:'cover', border:'1px solid #e8d5b7' }}/>}
                              <div>
                                <div style={{ fontWeight:600 }}>{item.product_name?.slice(0,35)}</div>
                                <div style={{ fontSize:10, fontFamily:'monospace', color:'#6b5b7b' }}>{item.item_code}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...S.td, color:'#6b5b7b' }}>{item.category}</td>
                          <td style={{ ...S.td, color:'#6b5b7b' }}>{item.brand}</td>
                          <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{item.qty}</td>
                          <td style={{ ...S.td, textAlign:'right' }}>{item.mrp>0?fmt_inr(item.mrp):'—'}</td>
                          <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{item.cost_per_unit>0?fmt_inr(item.cost_per_unit):'—'}</td>
                          <td style={{ ...S.td, textAlign:'right', fontWeight:600 }}>{item.stock_value>0?fmt_inr(item.stock_value):'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
