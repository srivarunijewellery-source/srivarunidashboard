'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { fmt_inr, fmt_num, getDateRange, type Grain } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import HoverImage from '@/components/ui/HoverImage'
import ProductModal from '@/components/ui/ProductModal'
import DateNav from '@/components/ui/DateNav'
import MetricCard from '@/components/ui/MetricCard'
import { useBranch } from '@/lib/branch-context'

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'10px 14px', fontSize:11, fontWeight:600, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'10px 12px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8' },
}

export default function InventoryPage() {
  const { selectedBranch } = useBranch()
  const [pivotRows, setPivotRows] = useState<any[]>([])
  const [allBrands, setAllBrands] = useState<string[]>([])
  const [drillKey, setDrillKey] = useState<{cat:string;brand:string}|null>(null)
  const [drillItems, setDrillItems] = useState<any[]>([])
  const [snapLoading, setSnapLoading] = useState(false)
  const [productItemCode, setProductItemCode] = useState<string|null>(null)

  // ── Category/Brand performance cut ──────────────────────────────────────
  const [cutCategories, setCutCategories] = useState<string[]>([])
  const [cutBrands, setCutBrands] = useState<string[]>([])
  const [cutCategory, setCutCategory] = useState('ALL')
  const [cutBrand, setCutBrand] = useState('ALL')
  const [cutGrain, setCutGrain] = useState<Grain>('month')
  const [cutOffset, setCutOffset] = useState(0)
  const [cutMetrics, setCutMetrics] = useState({ sold_qty:0, sold_revenue:0, in_stock_qty:0, stock_value:0 })
  const [cutLoading, setCutLoading] = useState(false)
  const cutRange = getDateRange(cutGrain, cutOffset)

  // Discover category/brand options from live stock
  useEffect(() => {
    supabase.from('inventory_with_cost').select('category,brand').gt('qty',0).limit(10000).then(({ data }) => {
      if (!data) return
      setCutCategories([...new Set(data.map((d:any)=>d.category).filter(Boolean))].sort())
      setCutBrands([...new Set(data.map((d:any)=>d.brand).filter(Boolean))].sort())
    })
  }, [])

  const loadCut = useCallback(async () => {
    setCutLoading(true)
    try {
      // Sold in the selected period, filtered by category/brand
      const sales = await fetchAllRows('sales', 'category,brand,qty,net_amount', q => {
        let qq = q.gte('date', cutRange.from).lte('date', cutRange.to)
        if (cutCategory!=='ALL') qq = qq.eq('category', cutCategory)
        if (cutBrand!=='ALL') qq = qq.eq('brand', cutBrand)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })
      const sold_qty = sales.reduce((s,r)=>s+(r.qty||0),0)
      const sold_revenue = sales.reduce((s,r)=>s+(r.net_amount||0),0)

      // Currently in stock, filtered the same way (live snapshot, not branch-scoped —
      // inventory_with_cost has no branch_id column yet)
      let invQ = supabase.from('inventory_with_cost').select('qty,stock_value,cost_per_unit').gt('qty',0)
      if (cutCategory!=='ALL') invQ = invQ.eq('category', cutCategory)
      if (cutBrand!=='ALL') invQ = invQ.eq('brand', cutBrand)
      const { data: inv } = await invQ.limit(10000)
      const in_stock_qty = (inv||[]).reduce((s,r:any)=>s+(r.qty||0),0)
      const stock_value = (inv||[]).reduce((s,r:any)=>s+(r.stock_value||(r.cost_per_unit||0)*(r.qty||0)),0)

      setCutMetrics({ sold_qty, sold_revenue, in_stock_qty, stock_value })
    } finally { setCutLoading(false) }
  }, [cutCategory, cutBrand, cutRange.from, cutRange.to, selectedBranch])

  useEffect(() => { loadCut() }, [loadCut])

  const loadSnapshot = useCallback(async () => {
    setSnapLoading(true)
    try {
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

  useEffect(() => { loadSnapshot() }, [loadSnapshot])

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Inventory" subtitle="Live stock snapshot by category and brand" />
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* ═══════════ CATEGORY / BRAND PERFORMANCE CUT ═══════════ */}
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <h2 className="font-display" style={{ fontSize:17, color:'#3b0764', margin:0 }}>Category / Brand Performance</h2>
            <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Pick a category and/or brand — see units sold in the selected period vs. units still in stock right now</p>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:12 }}>
            <div>
              <label style={{ fontSize:10, color:'#6b5b7b', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:4 }}>Category</label>
              <select value={cutCategory} onChange={e=>setCutCategory(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e', background:'#fff', minWidth:160 }}>
                <option value="ALL">All Categories</option>
                {cutCategories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:'#6b5b7b', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:4 }}>Brand</label>
              <select value={cutBrand} onChange={e=>setCutBrand(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e', background:'#fff', minWidth:160 }}>
                <option value="ALL">All Brands</option>
                {cutBrands.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <DateNav grain={cutGrain} onGrainChange={setCutGrain} offset={cutOffset} onOffsetChange={setCutOffset} label={cutRange.label} />
            </div>
          </div>

          {cutLoading ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {Array.from({length:4}).map((_,i)=><div key={i} style={{ height:80, background:'#f5f0e8', borderRadius:14 }}/>)}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              <MetricCard label="Sold" value={fmt_num(cutMetrics.sold_qty)} sub={cutRange.label} accent="purple"/>
              <MetricCard label="Revenue" value={fmt_inr(cutMetrics.sold_revenue)} sub={cutRange.label} accent="green"/>
              <MetricCard label="In Stock Now" value={fmt_num(cutMetrics.in_stock_qty)} accent="beige"/>
              <MetricCard label="Stock Value" value={fmt_inr(cutMetrics.stock_value)} accent="beige"/>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Stock Snapshot — Category × Brand</h2>
          <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Click any cell for product detail · Stock value from purchase rates · Sold items are on the Sales → Details page</p>
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
                <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{drillItems.length} products in stock · click a name or barcode for full detail</p>
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
                          <HoverImage src={item.image_url} alt={item.product_name} previewSize={280}
                            wrapperStyle={{ width:36, height:36, borderRadius:8, border:'1px solid #e8d5b7', flexShrink:0 }}
                            style={{ width:36, height:36, borderRadius:8 }} />
                          <div>
                            <div onClick={()=>setProductItemCode(item.item_code)} style={{ fontWeight:600, color:'#3b0764', cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd' }}>{item.product_name?.slice(0,35)}</div>
                            <div onClick={()=>setProductItemCode(item.item_code)} style={{ fontSize:10, fontFamily:'monospace', color:'#6b5b7b', cursor:'pointer' }}>{item.item_code}</div>
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
      </div>

      {productItemCode && <ProductModal itemCode={productItemCode} onClose={()=>setProductItemCode(null)} />}
    </div>
  )
}
