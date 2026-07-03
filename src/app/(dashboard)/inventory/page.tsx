'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchAllRows } from '@/lib/supabase'
import { fmt_inr, fmt_num, getDateRange, normalizeCategory, buildCategoryGroups, vasyErpProductUrl } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import HoverImage from '@/components/ui/HoverImage'
import DateNav from '@/components/ui/DateNav'
import MetricCard from '@/components/ui/MetricCard'
import { useBranch } from '@/lib/branch-context'
import { useDateRange } from '@/lib/date-range-context'
import { ExternalLink } from 'lucide-react'

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'8px 10px', fontSize:10, fontWeight:700, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', border:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'6px 10px', fontSize:12, color:'#1a0a2e', border:'1px solid #f0e8d8', whiteSpace:'nowrap' as const },
  totalTd: { padding:'6px 10px', fontSize:12, color:'#3b0764', border:'1px solid #e8d5b7', whiteSpace:'nowrap' as const, fontWeight:700, background:'#f5f0ff' },
}
const DRILL_PAGE_SIZE = 30

// Stock value can legitimately be ₹0 (free/promotional stock) — using `??`
// instead of `||` everywhere below so a real zero isn't silently replaced
// by a recomputed fallback.
function stockValueOf(p: any): number {
  return p.stock_value ?? (p.cost_per_unit ?? 0) * (p.qty ?? 0)
}

function openInErp(productId?: string) {
  const url = vasyErpProductUrl(productId)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export default function InventoryPage() {
  const { selectedBranch } = useBranch()
  const [drillKey, setDrillKey] = useState<{cat:string;brand:string}|null>(null)
  const [drillPage, setDrillPage] = useState(0)

  // ── Single source of truth for all in-stock inventory ──────────────────
  const [allInventory, setAllInventory] = useState<any[]>([])
  const [invLoading, setInvLoading] = useState(false)

  const loadInventory = useCallback(async () => {
    setInvLoading(true)
    try {
      const data = await fetchAllRows('inventory_with_cost', 'item_code,product_name,category,brand,qty,cost_per_unit,stock_value,image_url,product_id', q => q.gt('qty', 0))
      setAllInventory(data)
    } finally { setInvLoading(false) }
  }, [])
  useEffect(() => { loadInventory() }, [loadInventory])

  // Category rationalization — the ERP has near-duplicate spellings
  // ("BANGLE" vs "bangles", "mang tika" vs "Maang Tikka", "Short Haram" vs
  // "Short Necklace", etc). normalizeCategory() rolls them all up to one
  // canonical name everywhere below.
  const categoryGroups = useMemo(() => buildCategoryGroups(allInventory.map(r=>r.category)), [allInventory])
  const canonicalCategories = useMemo(() => categoryGroups.map(g=>g.canonical), [categoryGroups])
  const allBrandsList = useMemo(() => [...new Set(allInventory.map(r=>r.brand).filter(Boolean))].sort(), [allInventory])

  // One row per item_code — batches for the same product are summed
  // together so the same product can never appear twice.
  const productsByItemCode = useMemo(() => {
    const map: Record<string, any> = {}
    for (const p of allInventory) {
      const key = p.item_code
      if (!map[key]) {
        map[key] = { ...p, category: normalizeCategory(p.category), qty: 0, stock_value: 0, _batches: 0 }
      }
      map[key].qty += p.qty ?? 0
      map[key].stock_value += stockValueOf(p)
      map[key]._batches += 1
      if (!map[key].image_url && p.image_url) map[key].image_url = p.image_url
    }
    return Object.values(map)
  }, [allInventory])

  const { rows: pivotRows, brands: pivotBrands, grandTotal } = useMemo(() => {
    const map: Record<string, any> = {}
    const brandTotals: Record<string, number> = {}
    const grand = { qty:0, value:0 }
    for (const p of productsByItemCode) {
      const cat = p.category
      const br = p.brand || 'Unknown'
      brandTotals[br] = (brandTotals[br] || 0) + p.qty
      grand.qty += p.qty; grand.value += p.stock_value
      if (!map[cat]) map[cat] = { category:cat, total:{qty:0,value:0}, brands:{} }
      map[cat].total.qty += p.qty
      map[cat].total.value += p.stock_value
      if (!map[cat].brands[br]) map[cat].brands[br] = { qty:0, value:0 }
      map[cat].brands[br].qty += p.qty
      map[cat].brands[br].value += p.stock_value
    }
    return {
      rows: Object.values(map).sort((a:any,b:any)=>b.total.qty-a.total.qty),
      brands: Object.keys(brandTotals).sort((a,b)=>brandTotals[b]-brandTotals[a]),
      grandTotal: grand,
      brandTotals,
    }
  }, [productsByItemCode])

  const drillItems = useMemo(() => {
    if (!drillKey) return []
    return productsByItemCode.filter((p:any) => {
      if (drillKey.cat!=='ALL' && p.category!==drillKey.cat) return false
      if (drillKey.brand!=='ALL' && (p.brand||'Unknown')!==drillKey.brand) return false
      return true
    }).sort((a:any,b:any)=>b.qty-a.qty)
  }, [productsByItemCode, drillKey])

  const drillTotals = useMemo(() => ({
    qty: drillItems.reduce((s:number,p:any)=>s+p.qty,0),
    value: drillItems.reduce((s:number,p:any)=>s+p.stock_value,0),
  }), [drillItems])

  useEffect(() => { setDrillPage(0) }, [drillKey])
  const drillPageItems = drillItems.slice(drillPage*DRILL_PAGE_SIZE, (drillPage+1)*DRILL_PAGE_SIZE)
  const drillTotalPages = Math.ceil(drillItems.length/DRILL_PAGE_SIZE)

  // ── Category/Brand performance cut ──────────────────────────────────────
  const [cutCategory, setCutCategory] = useState('ALL')
  const [cutBrand, setCutBrand] = useState('ALL')
  const { grain: cutGrain, offset: cutOffset, setGrain: setCutGrain, setOffset: setCutOffset } = useDateRange()
  const cutRange = getDateRange(cutGrain, cutOffset)
  const [cutSold, setCutSold] = useState({ qty:0, revenue:0 })
  const [cutLoading, setCutLoading] = useState(false)

  const cutStock = useMemo(() => {
    const filtered = productsByItemCode.filter((p:any) => {
      if (cutCategory!=='ALL' && p.category!==cutCategory) return false
      if (cutBrand!=='ALL' && (p.brand||'Unknown')!==cutBrand) return false
      return true
    })
    return {
      qty: filtered.reduce((s:number,r:any)=>s+r.qty,0),
      value: filtered.reduce((s:number,r:any)=>s+r.stock_value,0),
    }
  }, [productsByItemCode, cutCategory, cutBrand])

  const loadCutSold = useCallback(async () => {
    setCutLoading(true)
    try {
      const sales = await fetchAllRows('sales', 'category,brand,qty,net_amount', q => {
        let qq = q.gte('date', cutRange.from).lte('date', cutRange.to)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })
      const filtered = sales.filter(r => {
        if (cutCategory!=='ALL' && normalizeCategory(r.category)!==cutCategory) return false
        if (cutBrand!=='ALL' && (r.brand||'Unknown')!==cutBrand) return false
        return true
      })
      setCutSold({ qty: filtered.reduce((s,r)=>s+(r.qty||0),0), revenue: filtered.reduce((s,r)=>s+(r.net_amount||0),0) })
    } finally { setCutLoading(false) }
  }, [cutCategory, cutBrand, cutRange.from, cutRange.to, selectedBranch])

  useEffect(() => { loadCutSold() }, [loadCutSold])

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
                {canonicalCategories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:'#6b5b7b', textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:4 }}>Brand</label>
              <select value={cutBrand} onChange={e=>setCutBrand(e.target.value)} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e', background:'#fff', minWidth:160 }}>
                <option value="ALL">All Brands</option>
                {allBrandsList.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <DateNav grain={cutGrain} onGrainChange={setCutGrain} offset={cutOffset} onOffsetChange={setCutOffset} label={cutRange.label} />
            </div>
          </div>

          {(cutLoading||invLoading) ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {Array.from({length:4}).map((_,i)=><div key={i} style={{ height:80, background:'#f5f0e8', borderRadius:14 }}/>)}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              <MetricCard label="Sold" value={fmt_num(cutSold.qty)} sub={cutRange.label} accent="purple"/>
              <MetricCard label="Revenue" value={fmt_inr(cutSold.revenue)} sub={cutRange.label} accent="green"/>
              <MetricCard label="In Stock Now" value={fmt_num(cutStock.qty)} accent="beige"/>
              <MetricCard label="Stock Value" value={fmt_inr(cutStock.value)} accent="beige"/>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Stock Snapshot — Category × Brand</h2>
          <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Click any cell for the product list · one row per product (multi-batch items summed) · click a product to open it in VasyERP</p>
        </div>

        {invLoading?<div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>:(
          <div style={S.section}>
            <div style={{ overflow:'auto', maxHeight:460 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, border:'1px solid #e8d5b7' }}>
                <thead>
                  <tr style={{ background:'#3b0764' }}>
                    <th style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, top:0, minWidth:150, zIndex:2 }}>Category</th>
                    <th style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'right', cursor:'pointer', position:'sticky', top:0, zIndex:1 }} onClick={()=>setDrillKey({cat:'ALL',brand:'ALL'})}>TOTAL</th>
                    {pivotBrands.map(b=><th key={b} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'right', minWidth:90, position:'sticky', top:0, zIndex:1 }}>{b}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row:any,ri)=>(
                    <tr key={row.category} style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, color:'#3b0764', fontWeight:700, position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff', cursor:'pointer' }} onClick={()=>setDrillKey({cat:row.category,brand:'ALL'})}>{row.category}</td>
                      <td style={{ ...S.td, textAlign:'right', cursor:'pointer' }} onClick={()=>setDrillKey({cat:row.category,brand:'ALL'})}>
                        <span style={{ fontWeight:700 }}>{fmt_num(row.total.qty)}</span>
                        <span style={{ color:'#6b5b7b', fontSize:10 }}> · {row.total.value>0?fmt_inr(row.total.value):'(cost N/A)'}</span>
                      </td>
                      {pivotBrands.map(b=>{
                        const cell=row.brands[b]
                        return (
                          <td key={b} style={{ ...S.td, textAlign:'right', cursor:cell?'pointer':'default', background:cell?undefined:'#fafafa' }} onClick={()=>cell&&setDrillKey({cat:row.category,brand:b})}>
                            {cell?(<><span style={{ fontWeight:600 }}>{fmt_num(cell.qty)}</span><span style={{ color:'#6b5b7b', fontSize:10 }}> · {cell.value>0?fmt_inr(cell.value):'—'}</span></>):<span style={{ color:'#e8d5b7' }}>—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...S.totalTd, position:'sticky', left:0 }}>TOTAL (ALL CATEGORIES)</td>
                    <td style={{ ...S.totalTd, textAlign:'right' }}>
                      <span>{fmt_num(grandTotal.qty)}</span>
                      <span style={{ fontSize:10 }}> · {grandTotal.value>0?fmt_inr(grandTotal.value):'—'}</span>
                    </td>
                    {pivotBrands.map(b=>{
                      const bt = pivotRows.reduce((s:number,row:any)=>s+(row.brands[b]?.qty||0),0)
                      const bv = pivotRows.reduce((s:number,row:any)=>s+(row.brands[b]?.value||0),0)
                      return (
                        <td key={b} style={{ ...S.totalTd, textAlign:'right' }}>
                          <span>{fmt_num(bt)}</span>
                          <span style={{ fontSize:10 }}> · {bv>0?fmt_inr(bv):'—'}</span>
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {drillKey&&(
          <div style={S.section}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 className="font-display" style={{ color:'#3b0764', margin:0, fontSize:15 }}>
                  {drillKey.cat==='ALL'?'All Products':drillKey.brand==='ALL'?drillKey.cat:`${drillKey.cat} — ${drillKey.brand}`}
                </h3>
                <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>
                  {drillItems.length} products · {fmt_num(drillTotals.qty)} units · {fmt_inr(drillTotals.value)} · click a product to open it in VasyERP
                </p>
              </div>
              <button onClick={()=>setDrillKey(null)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:'pointer', color:'#6b5b7b' }}>Close ×</button>
            </div>
            {drillItems.length===0 ? (
              <div style={{ padding:32, textAlign:'center', color:'#6b5b7b', fontSize:13 }}>No products match this selection.</div>
            ) : (
            <>
            <div style={{ overflow:'auto', maxHeight:460 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, border:'1px solid #e8d5b7' }}>
                <thead><tr>{['Product','Barcode','Category','Brand','Stock','Cost/Unit','Stock Value',''].map(h=><th key={h} style={{...S.th, position:'sticky', top:0}}>{h}</th>)}</tr></thead>
                <tbody>
                  {drillPageItems.map((item:any,i:number)=>(
                    <tr key={item.item_code} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={S.td}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <HoverImage src={item.image_url} alt={item.product_name} previewSize={280}
                            wrapperStyle={{ width:28, height:28, borderRadius:6, border:'1px solid #e8d5b7', flexShrink:0 }}
                            style={{ width:28, height:28, borderRadius:6 }} />
                          <span onClick={()=>openInErp(item.product_id)}
                            style={{ fontWeight:600, color:'#3b0764', cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd', overflow:'hidden', textOverflow:'ellipsis', maxWidth:220 }}>{item.product_name?.slice(0,40)}</span>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontFamily:'monospace', color:'#6b5b7b', fontSize:10 }}>{item.item_code}</td>
                      <td style={{ ...S.td, color:'#6b5b7b' }}>{item.category}</td>
                      <td style={{ ...S.td, color:'#6b5b7b' }}>{item.brand}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{item.qty}{item._batches>1?<span style={{fontSize:9,color:'#6b5b7b'}}> ({item._batches} batches)</span>:''}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{item.cost_per_unit>0?fmt_inr(item.cost_per_unit):'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:600 }}>{item.stock_value>0?fmt_inr(item.stock_value):'—'}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <button onClick={()=>openInErp(item.product_id)} title="Open in VasyERP" style={{ background:'none', border:'none', cursor:'pointer', color:'#7c3aed', display:'flex', alignItems:'center' }}>
                          <ExternalLink size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={S.totalTd} colSpan={4}>TOTAL ({drillItems.length} products)</td>
                    <td style={{ ...S.totalTd, textAlign:'right' }}>{fmt_num(drillTotals.qty)}</td>
                    <td style={S.totalTd}></td>
                    <td style={{ ...S.totalTd, textAlign:'right' }}>{drillTotals.value>0?fmt_inr(drillTotals.value):'—'}</td>
                    <td style={S.totalTd}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {drillTotalPages>1&&(
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'12px 0' }}>
                <button onClick={()=>setDrillPage(p=>Math.max(0,p-1))} disabled={drillPage===0} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:drillPage===0?'default':'pointer', color:drillPage===0?'#ccc':'#3b0764' }}>← Prev</button>
                <span style={{ fontSize:12, color:'#6b5b7b' }}>{drillPage*DRILL_PAGE_SIZE+1}–{Math.min((drillPage+1)*DRILL_PAGE_SIZE,drillItems.length)} of {drillItems.length}</span>
                <button onClick={()=>setDrillPage(p=>Math.min(drillTotalPages-1,p+1))} disabled={drillPage>=drillTotalPages-1} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:drillPage>=drillTotalPages-1?'default':'pointer', color:drillPage>=drillTotalPages-1?'#ccc':'#3b0764' }}>Next →</button>
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
