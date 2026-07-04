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
import { ExternalLink, Tags, Sparkles, LayoutGrid, ChevronDown, X } from 'lucide-react'
import { useSortable } from '@/lib/useSortable'
import SortIndicator from '@/components/ui/SortIndicator'

// Numeric cells always use tabular figures so digits line up vertically
// regardless of how many characters they have — this, plus splitting
// "qty · value" into two real columns instead of one combined string, is
// what actually fixes ragged alignment (a middot in a variable-width
// string can't align consistently no matter how it's styled).
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'9px 12px', fontSize:10, fontWeight:700, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.6, background:'#f5f0e8', borderBottom:'2px solid #e8d5b7', borderRight:'1px solid #ece1cc', whiteSpace:'nowrap' as const },
  td: { padding:'7px 12px', fontSize:12.5, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8', borderRight:'1px solid #f5f0e8', whiteSpace:'nowrap' as const },
  totalTd: { padding:'8px 12px', fontSize:12.5, color:'#3b0764', borderTop:'2px solid #7c3aed', borderRight:'1px solid #ded0f5', whiteSpace:'nowrap' as const, fontWeight:700, background:'#f5f0ff' },
}
const DRILL_PAGE_SIZE = 30

function stockValueOf(p: any): number {
  return p.stock_value ?? (p.cost_per_unit ?? 0) * (p.qty ?? 0)
}

function openInErp(productId?: string) {
  const url = vasyErpProductUrl(productId)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

// A styled native <select> — keeps full accessibility/keyboard behaviour
// of a real <select> while matching the app's purple/cream identity
// instead of the browser default.
function FilterSelect({ icon: Icon, label, value, onChange, options, allLabel }: {
  icon: any; label: string; value: string; onChange: (v: string) => void
  options: string[]; allLabel: string
}) {
  const isActive = value !== 'ALL'
  return (
    <div>
      <label style={{ fontSize:10, color:'#8b7d97', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
        <Icon size={11}/> {label}
      </label>
      <div style={{ position:'relative' }}>
        <select value={value} onChange={e=>onChange(e.target.value)} style={{
          appearance:'none', WebkitAppearance:'none',
          padding:'9px 34px 9px 14px', borderRadius:10, fontSize:13, fontWeight:isActive?600:500,
          color: isActive?'#3b0764':'#4a3d5c',
          background: isActive?'#f3ecff':'#faf8f4',
          border:`1.5px solid ${isActive?'#c4a7f0':'#e8d5b7'}`,
          minWidth:180, cursor:'pointer', outline:'none',
        }}>
          <option value="ALL">{allLabel}</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:isActive?'#7c3aed':'#a99bb8', pointerEvents:'none' }}/>
        {isActive && (
          <button onClick={()=>onChange('ALL')} title={`Clear ${label.toLowerCase()}`} style={{
            position:'absolute', right:-8, top:-8, width:18, height:18, borderRadius:'50%',
            background:'#7c3aed', color:'#fff', border:'2px solid #fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', padding:0,
          }}><X size={10}/></button>
        )}
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { selectedBranch } = useBranch()
  const [drillKey, setDrillKey] = useState<{cat:string;brand:string}|null>(null)
  const [drillPage, setDrillPage] = useState(0)

  const [allInventory, setAllInventory] = useState<any[]>([])
  const [invLoading, setInvLoading] = useState(false)

  const loadInventory = useCallback(async () => {
    setInvLoading(true)
    try {
      const data = await fetchAllRows('computed_inventory', 'item_code,product_name,category,brand,qty,cost_per_unit,stock_value,image_url,product_id', q => q.gt('qty', 0), 'item_code')
      setAllInventory(data)
    } finally { setInvLoading(false) }
  }, [])
  useEffect(() => { loadInventory() }, [loadInventory])

  const categoryGroups = useMemo(() => buildCategoryGroups(allInventory.map(r=>r.category)), [allInventory])
  const canonicalCategories = useMemo(() => categoryGroups.map(g=>g.canonical), [categoryGroups])
  const allBrandsList = useMemo(() => [...new Set(allInventory.map(r=>r.brand).filter(Boolean))].sort(), [allInventory])

  const productsByItemCode = useMemo(() => {
    const map: Record<string, any> = {}
    for (const p of allInventory) {
      const key = p.item_code
      if (!map[key]) map[key] = { ...p, category: normalizeCategory(p.category), qty: 0, stock_value: 0, _batches: 0 }
      map[key].qty += p.qty ?? 0
      map[key].stock_value += stockValueOf(p)
      map[key]._batches += 1
      if (!map[key].image_url && p.image_url) map[key].image_url = p.image_url
    }
    return Object.values(map)
  }, [allInventory])

  const { rows: pivotRows, brandTotals, grandTotal } = useMemo(() => {
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
      brandTotals,
      grandTotal: grand,
    }
  }, [productsByItemCode])

  // Column sort — the direct mirror of row sorting. Rows are sorted by
  // clicking a column header (a column's values reorder the rows); here
  // clicking the column-sort toggle reorders the COLUMNS (brands) by
  // their own overall total qty, highest-to-lowest by default, flipping
  // to lowest-to-highest on a second click. This only makes sense where
  // columns share one comparable metric (brands here) — Expenses' month
  // columns stay chronological on purpose, since scrambling them would
  // break the month-over-month % change logic.
  const [colSortDir, setColSortDir] = useState<'asc'|'desc'>('desc')
  const pivotBrands = useMemo(() => {
    return Object.keys(brandTotals).sort((a,b)=> colSortDir==='desc' ? brandTotals[b]-brandTotals[a] : brandTotals[a]-brandTotals[b])
  }, [brandTotals, colSortDir])

  // Click any column header to sort — first click highest-to-lowest,
  // second click flips to lowest-to-highest. Since rows here ARE the
  // categories, sorting by any column (including a specific brand's
  // Qty/Value) reorders the rows accordingly — this is the "sort rows
  // too" behaviour for this table.
  const pivotGetValue = useCallback((row: any, key: string) => {
    if (key === 'category') return row.category
    if (key === 'total_qty') return row.total.qty
    if (key === 'total_value') return row.total.value
    const [, brand, field] = key.split('::')
    return row.brands[brand]?.[field] ?? -1
  }, [])
  const { sorted: sortedPivotRows, sortKey: pivotSortKey, sortDir: pivotSortDir, toggleSort: togglePivotSort } = useSortable(pivotRows, pivotGetValue)

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

  const drillGetValue = useCallback((item: any, key: string) => item[key], [])
  const { sorted: sortedDrillItems, sortKey: drillSortKey, sortDir: drillSortDir, toggleSort: toggleDrillSort } = useSortable(drillItems, drillGetValue)

  useEffect(() => { setDrillPage(0) }, [drillKey])
  const drillPageItems = sortedDrillItems.slice(drillPage*DRILL_PAGE_SIZE, (drillPage+1)*DRILL_PAGE_SIZE)
  const drillTotalPages = Math.ceil(sortedDrillItems.length/DRILL_PAGE_SIZE)

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
    return { qty: filtered.reduce((s:number,r:any)=>s+r.qty,0), value: filtered.reduce((s:number,r:any)=>s+r.stock_value,0) }
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
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:22 }}>

        {/* ═══════════ CATEGORY / BRAND PERFORMANCE CUT ═══════════ */}
        <div style={{
          borderRadius:18, overflow:'hidden', border:'1px solid #e8d5b7', boxShadow:'0 4px 16px rgba(59,7,100,0.08)',
        }}>
          <div style={{ background:'linear-gradient(120deg, #3b0764 0%, #5b21b6 100%)', padding:'16px 22px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Sparkles size={16} color="#fff"/>
            </div>
            <div>
              <h2 className="font-display" style={{ fontSize:16, color:'#fff', margin:0 }}>Category / Brand Performance</h2>
              <p style={{ fontSize:11.5, color:'#d4c2f0', margin:'2px 0 0' }}>Units sold in the selected period vs. units still in stock right now</p>
            </div>
          </div>

          <div style={{ background:'#fff', padding:'20px 22px', display:'flex', flexDirection:'column', gap:18 }}>
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:20 }}>
              <FilterSelect icon={Tags} label="Category" value={cutCategory} onChange={setCutCategory} options={canonicalCategories} allLabel="All Categories"/>
              <FilterSelect icon={LayoutGrid} label="Brand" value={cutBrand} onChange={setCutBrand} options={allBrandsList} allLabel="All Brands"/>
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
        </div>

        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Stock Snapshot — Category × Brand</h2>
            <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Click any cell for the product list · one row per product (multi-batch items summed) · click a product to open it in VasyERP</p>
          </div>
          <button onClick={()=>setColSortDir(d=>d==='desc'?'asc':'desc')} style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:9, cursor:'pointer',
            border:'1px solid #e8d5b7', background:'#fff', fontSize:12, fontWeight:600, color:'#3b0764',
          }}>
            Brand columns: {colSortDir==='desc'?'Highest → Lowest':'Lowest → Highest'}
            <SortIndicator active dir={colSortDir}/>
          </button>
        </div>

        {invLoading?<div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>:(
          <div style={S.section}>
            <div style={{ overflow:'auto', maxHeight:480 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th onClick={()=>togglePivotSort('category')} style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, top:0, minWidth:150, zIndex:3, borderRight:'2px solid #2a044a', cursor:'pointer' }}>
                      Category<SortIndicator active={pivotSortKey==='category'} dir={pivotSortDir}/>
                    </th>
                    <th colSpan={2} style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'center', cursor:'pointer', position:'sticky', top:0, zIndex:2 }} onClick={()=>setDrillKey({cat:'ALL',brand:'ALL'})}>TOTAL</th>
                    {pivotBrands.map(b=>(
                      <th key={b} colSpan={2} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'center', minWidth:140, position:'sticky', top:0, zIndex:1 }}>{b}</th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', position:'sticky', left:0, top:32, zIndex:3, borderRight:'2px solid #2a044a' }}></th>
                    <th onClick={()=>togglePivotSort('total_qty')} style={{ ...S.th, background:'#3b0764', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:2, cursor:'pointer' }}>
                      Qty<SortIndicator active={pivotSortKey==='total_qty'} dir={pivotSortDir}/>
                    </th>
                    <th onClick={()=>togglePivotSort('total_value')} style={{ ...S.th, background:'#3b0764', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:2, cursor:'pointer' }}>
                      Value<SortIndicator active={pivotSortKey==='total_value'} dir={pivotSortDir}/>
                    </th>
                    {pivotBrands.map(b=>(
                      <>
                        <th key={b+'q'} onClick={()=>togglePivotSort(`brand::${b}::qty`)} style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:1, cursor:'pointer' }}>
                          Qty<SortIndicator active={pivotSortKey===`brand::${b}::qty`} dir={pivotSortDir}/>
                        </th>
                        <th key={b+'v'} onClick={()=>togglePivotSort(`brand::${b}::value`)} style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:1, cursor:'pointer' }}>
                          Value<SortIndicator active={pivotSortKey===`brand::${b}::value`} dir={pivotSortDir}/>
                        </th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPivotRows.map((row:any,ri)=>(
                    <tr key={row.category} className="inv-row" style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, color:'#3b0764', fontWeight:700, position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff', cursor:'pointer', borderRight:'2px solid #e8d5b7' }} onClick={()=>setDrillKey({cat:row.category,brand:'ALL'})}>{row.category}</td>
                      <td style={{ ...S.td, ...NUM, fontWeight:700, cursor:'pointer', background:'#faf6ff' }} onClick={()=>setDrillKey({cat:row.category,brand:'ALL'})}>{fmt_num(row.total.qty)}</td>
                      <td style={{ ...S.td, ...NUM, fontWeight:700, cursor:'pointer', color:'#6b5b7b', background:'#faf6ff' }} onClick={()=>setDrillKey({cat:row.category,brand:'ALL'})}>{row.total.value>0?fmt_inr(row.total.value):'—'}</td>
                      {pivotBrands.map(b=>{
                        const cell=row.brands[b]
                        return (
                          <>
                            <td key={b+'q'} style={{ ...S.td, ...NUM, fontWeight:cell?600:400, cursor:cell?'pointer':'default', background:cell?undefined:'#fafafa', color:cell?'#1a0a2e':'#d8cfe0' }} onClick={()=>cell&&setDrillKey({cat:row.category,brand:b})}>{cell?fmt_num(cell.qty):'—'}</td>
                            <td key={b+'v'} style={{ ...S.td, ...NUM, cursor:cell?'pointer':'default', background:cell?undefined:'#fafafa', color:cell?'#6b5b7b':'#d8cfe0' }} onClick={()=>cell&&setDrillKey({cat:row.category,brand:b})}>{cell&&cell.value>0?fmt_inr(cell.value):cell?'—':''}</td>
                          </>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...S.totalTd, position:'sticky', left:0, borderRight:'2px solid #ded0f5' }}>GRAND TOTAL</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{fmt_num(grandTotal.qty)}</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{grandTotal.value>0?fmt_inr(grandTotal.value):'—'}</td>
                    {pivotBrands.map(b=>{
                      const bt = pivotRows.reduce((s:number,row:any)=>s+(row.brands[b]?.qty||0),0)
                      const bv = pivotRows.reduce((s:number,row:any)=>s+(row.brands[b]?.value||0),0)
                      return (
                        <>
                          <td key={b+'q'} style={{ ...S.totalTd, ...NUM }}>{fmt_num(bt)}</td>
                          <td key={b+'v'} style={{ ...S.totalTd, ...NUM }}>{bv>0?fmt_inr(bv):'—'}</td>
                        </>
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
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    <th onClick={()=>toggleDrillSort('product_name')} style={{ ...S.th, position:'sticky', top:0, cursor:'pointer' }}>Product<SortIndicator active={drillSortKey==='product_name'} dir={drillSortDir}/></th>
                    <th onClick={()=>toggleDrillSort('item_code')} style={{ ...S.th, position:'sticky', top:0, cursor:'pointer' }}>Barcode<SortIndicator active={drillSortKey==='item_code'} dir={drillSortDir}/></th>
                    <th onClick={()=>toggleDrillSort('category')} style={{ ...S.th, position:'sticky', top:0, cursor:'pointer' }}>Category<SortIndicator active={drillSortKey==='category'} dir={drillSortDir}/></th>
                    <th onClick={()=>toggleDrillSort('brand')} style={{ ...S.th, position:'sticky', top:0, cursor:'pointer' }}>Brand<SortIndicator active={drillSortKey==='brand'} dir={drillSortDir}/></th>
                    <th onClick={()=>toggleDrillSort('qty')} style={{ ...S.th, position:'sticky', top:0, textAlign:'right', cursor:'pointer' }}>Stock<SortIndicator active={drillSortKey==='qty'} dir={drillSortDir}/></th>
                    <th onClick={()=>toggleDrillSort('cost_per_unit')} style={{ ...S.th, position:'sticky', top:0, textAlign:'right', cursor:'pointer' }}>Cost/Unit<SortIndicator active={drillSortKey==='cost_per_unit'} dir={drillSortDir}/></th>
                    <th onClick={()=>toggleDrillSort('stock_value')} style={{ ...S.th, position:'sticky', top:0, textAlign:'right', cursor:'pointer' }}>Stock Value<SortIndicator active={drillSortKey==='stock_value'} dir={drillSortDir}/></th>
                    <th style={{ ...S.th, position:'sticky', top:0 }}></th>
                  </tr>
                  {/* Totals pinned at the TOP, right under the headers, so they're
                      visible without scrolling to the bottom of a long list */}
                  <tr>
                    <td style={{ ...S.totalTd, position:'sticky', top:33, zIndex:1 }} colSpan={4}>TOTAL ({drillItems.length} products)</td>
                    <td style={{ ...S.totalTd, ...NUM, position:'sticky', top:33, zIndex:1 }}>{fmt_num(drillTotals.qty)}</td>
                    <td style={{ ...S.totalTd, position:'sticky', top:33, zIndex:1 }}></td>
                    <td style={{ ...S.totalTd, ...NUM, position:'sticky', top:33, zIndex:1 }}>{drillTotals.value>0?fmt_inr(drillTotals.value):'—'}</td>
                    <td style={{ ...S.totalTd, position:'sticky', top:33, zIndex:1 }}></td>
                  </tr>
                </thead>
                <tbody>
                  {drillPageItems.map((item:any,i:number)=>(
                    <tr key={item.item_code} className="inv-row" style={{ background:i%2===0?'#fff':'#faf8ff' }}>
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
                      <td style={{ ...S.td, ...NUM, fontWeight:700 }}>{item.qty}{item._batches>1?<span style={{fontSize:9,color:'#6b5b7b',fontWeight:400}}> ({item._batches}b)</span>:''}</td>
                      <td style={{ ...S.td, ...NUM, color:'#6b5b7b' }}>{item.cost_per_unit>0?fmt_inr(item.cost_per_unit):'—'}</td>
                      <td style={{ ...S.td, ...NUM, fontWeight:600 }}>{item.stock_value>0?fmt_inr(item.stock_value):'—'}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <button onClick={()=>openInErp(item.product_id)} title="Open in VasyERP" style={{ background:'none', border:'none', cursor:'pointer', color:'#7c3aed', display:'flex', alignItems:'center' }}>
                          <ExternalLink size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
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
