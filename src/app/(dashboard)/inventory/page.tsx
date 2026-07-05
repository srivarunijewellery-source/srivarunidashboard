'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchAllRows, fetchVendorMap } from '@/lib/supabase'
import { fmt_inr, fmt_num, getDateRange, normalizeCategory, buildCategoryGroups, vasyErpProductUrl } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import HoverImage from '@/components/ui/HoverImage'
import DateNav from '@/components/ui/DateNav'
import MetricCard from '@/components/ui/MetricCard'
import { useBranch } from '@/lib/branch-context'
import { useDateRange } from '@/lib/date-range-context'
import StockCard from '@/components/inventory/StockCard'
import ItemDeepDive from '@/components/inventory/ItemDeepDive'
import { ExternalLink, Tags, Sparkles, LayoutGrid, ChevronDown, X, Truck, Clock } from 'lucide-react'
import { useSortable } from '@/lib/useSortable'
import SortIndicator from '@/components/ui/SortIndicator'

const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'9px 12px', fontSize:10, fontWeight:700, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.6, background:'#f5f0e8', borderBottom:'2px solid #e8d5b7', borderRight:'1px solid #ece1cc', whiteSpace:'nowrap' as const },
  td: { padding:'7px 12px', fontSize:12.5, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8', borderRight:'1px solid #f5f0e8', whiteSpace:'nowrap' as const },
  totalTd: { padding:'8px 12px', fontSize:12.5, color:'#3b0764', borderTop:'2px solid #7c3aed', borderRight:'1px solid #ded0f5', whiteSpace:'nowrap' as const, fontWeight:700, background:'#f5f0ff' },
}
const DRILL_PAGE_SIZE = 30
const AGE_BUCKETS = ['<30 days','30-60 days','60-90 days','90-120 days','120-150 days','150-180 days','180+ days','Unknown'] as const

function stockValueOf(p: any): number {
  return p.stock_value ?? (p.cost_per_unit ?? 0) * (p.qty ?? 0)
}
function openInErp(productId?: string) {
  const url = vasyErpProductUrl(productId)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
function bucketOf(ageDays: number | null): typeof AGE_BUCKETS[number] {
  if (ageDays === null) return 'Unknown'
  if (ageDays < 30) return '<30 days'
  if (ageDays < 60) return '30-60 days'
  if (ageDays < 90) return '60-90 days'
  if (ageDays < 120) return '90-120 days'
  if (ageDays < 150) return '120-150 days'
  if (ageDays < 180) return '150-180 days'
  return '180+ days'
}

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
          minWidth:170, cursor:'pointer', outline:'none',
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

// Reusable product drill-down — rendered as tiles (same visual language as
// Sales -> Details' ProductCard grid), used by both Snapshot and Aging tabs
function ProductDrillTable({ items, title, subtitle, onClose }: { items: any[]; title: string; subtitle: string; onClose?: () => void }) {
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState('qty')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')
  useEffect(() => { setPage(0) }, [items])
  const sorted = useMemo(() => {
    return [...items].sort((a,b) => {
      const av = a[sortField], bv = b[sortField]
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av||0)-(bv||0)
      return sortDir==='asc' ? cmp : -cmp
    })
  }, [items, sortField, sortDir])
  const pageItems = sorted.slice(page*DRILL_PAGE_SIZE, (page+1)*DRILL_PAGE_SIZE)
  const totalPages = Math.ceil(sorted.length/DRILL_PAGE_SIZE)
  const totals = useMemo(() => ({
    qty: items.reduce((s,p)=>s+(p.qty||0),0),
    value: items.reduce((s,p)=>s+(p.stock_value||0),0),
  }), [items])

  return (
    <div style={S.section}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div>
          <h3 className="font-display" style={{ color:'#3b0764', margin:0, fontSize:15 }}>{title}</h3>
          <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{subtitle} · {fmt_num(totals.qty)} units · {totals.value>0?fmt_inr(totals.value):'—'} total</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <select value={sortField} onChange={e=>setSortField(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:12, color:'#3b0764', background:'#fff' }}>
            <option value="qty">Sort: Stock</option>
            <option value="stock_value">Sort: Stock Value</option>
            <option value="cost_per_unit">Sort: Cost/Unit</option>
            <option value="product_name">Sort: Product Name</option>
            <option value="brand">Sort: Brand</option>
            <option value="vendor">Sort: Vendor</option>
          </select>
          <button onClick={()=>setSortDir(d=>d==='desc'?'asc':'desc')} title="Flip sort direction" style={{ padding:'6px 8px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', display:'flex', color:'#3b0764' }}>
            <SortIndicator active dir={sortDir}/>
          </button>
          {onClose && <button onClick={onClose} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:'pointer', color:'#6b5b7b' }}>Close ×</button>}
        </div>
      </div>
      {items.length===0 ? (
        <div style={{ padding:32, textAlign:'center', color:'#6b5b7b', fontSize:13 }}>No products match this selection.</div>
      ) : (
      <>
        <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
          {pageItems.map((item:any)=><StockCard key={item.item_code} {...item}/>)}
        </div>
        {totalPages>1&&(
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'0 0 16px' }}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:page===0?'default':'pointer', color:page===0?'#ccc':'#3b0764' }}>← Prev</button>
            <span style={{ fontSize:12, color:'#6b5b7b' }}>{page*DRILL_PAGE_SIZE+1}–{Math.min((page+1)*DRILL_PAGE_SIZE,sorted.length)} of {sorted.length}</span>
            <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:page>=totalPages-1?'default':'pointer', color:page>=totalPages-1?'#ccc':'#3b0764' }}>Next →</button>
          </div>
        )}
      </>
      )}
    </div>
  )
}

// Reusable Category x Brand pivot (used by both Snapshot and Aging-bucket drill)
function CategoryBrandPivot({ items, onCellClick }: { items: any[]; onCellClick: (cat:string,brand:string)=>void }) {
  const [colSortDir, setColSortDir] = useState<'asc'|'desc'>('desc')
  const { rows, brandTotals } = useMemo(() => {
    const map: Record<string, any> = {}
    const brandTotals: Record<string, number> = {}
    for (const p of items) {
      const cat = p.category, br = p.brand || 'Unknown'
      brandTotals[br] = (brandTotals[br]||0) + p.qty
      if (!map[cat]) map[cat] = { category:cat, total:{qty:0,value:0}, brands:{} }
      map[cat].total.qty += p.qty; map[cat].total.value += p.stock_value
      if (!map[cat].brands[br]) map[cat].brands[br] = { qty:0, value:0 }
      map[cat].brands[br].qty += p.qty; map[cat].brands[br].value += p.stock_value
    }
    return { rows: Object.values(map).sort((a:any,b:any)=>b.total.qty-a.total.qty), brandTotals }
  }, [items])
  const brands = useMemo(() => Object.keys(brandTotals).sort((a,b)=> colSortDir==='desc' ? brandTotals[b]-brandTotals[a] : brandTotals[a]-brandTotals[b]), [brandTotals, colSortDir])
  const pivotGetValue = useCallback((row: any, key: string) => {
    if (key === 'category') return row.category
    if (key === 'total_qty') return row.total.qty
    if (key === 'total_value') return row.total.value
    const [, brand, field] = key.split('::')
    return row.brands[brand]?.[field] ?? -1
  }, [])
  const { sorted, sortKey, sortDir, toggleSort } = useSortable(rows, pivotGetValue)
  const grand = { qty: items.reduce((s,p)=>s+p.qty,0), value: items.reduce((s,p)=>s+p.stock_value,0) }

  return (
    <div style={S.section}>
      <div style={{ padding:'12px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p style={{ fontSize:12, color:'#6b5b7b', margin:0 }}>Click any cell for the product list</p>
        <button onClick={()=>setColSortDir(d=>d==='desc'?'asc':'desc')} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8, cursor:'pointer', border:'1px solid #e8d5b7', background:'#fff', fontSize:11, fontWeight:600, color:'#3b0764' }}>
          Brands: {colSortDir==='desc'?'High → Low':'Low → High'}<SortIndicator active dir={colSortDir}/>
        </button>
      </div>
      <div style={{ overflow:'auto', maxHeight:400 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              <th onClick={()=>toggleSort('category')} style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, top:0, minWidth:140, zIndex:3, cursor:'pointer' }}>Category<SortIndicator active={sortKey==='category'} dir={sortDir}/></th>
              <th colSpan={2} style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'center', position:'sticky', top:0, zIndex:2 }}>TOTAL</th>
              {brands.map(b=><th key={b} colSpan={2} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'center', minWidth:120, position:'sticky', top:0, zIndex:1 }}>{b}</th>)}
            </tr>
            <tr>
              <th style={{ ...S.th, background:'#2a044a', position:'sticky', left:0, top:32, zIndex:3 }}></th>
              <th onClick={()=>toggleSort('total_qty')} style={{ ...S.th, background:'#3b0764', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:2, cursor:'pointer' }}>Qty<SortIndicator active={sortKey==='total_qty'} dir={sortDir}/></th>
              <th onClick={()=>toggleSort('total_value')} style={{ ...S.th, background:'#3b0764', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:2, cursor:'pointer' }}>Value<SortIndicator active={sortKey==='total_value'} dir={sortDir}/></th>
              {brands.map(b=>(
                <>
                  <th key={b+'q'} onClick={()=>toggleSort(`brand::${b}::qty`)} style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:1, cursor:'pointer' }}>Qty<SortIndicator active={sortKey===`brand::${b}::qty`} dir={sortDir}/></th>
                  <th key={b+'v'} onClick={()=>toggleSort(`brand::${b}::value`)} style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:1, cursor:'pointer' }}>Value<SortIndicator active={sortKey===`brand::${b}::value`} dir={sortDir}/></th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row:any,ri)=>(
              <tr key={row.category} className="inv-row" style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                <td style={{ ...S.td, color:'#3b0764', fontWeight:700, position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff', cursor:'pointer' }} onClick={()=>onCellClick(row.category,'ALL')}>{row.category}</td>
                <td style={{ ...S.td, ...NUM, fontWeight:700, cursor:'pointer' }} onClick={()=>onCellClick(row.category,'ALL')}>{fmt_num(row.total.qty)}</td>
                <td style={{ ...S.td, ...NUM, cursor:'pointer', color:'#6b5b7b' }} onClick={()=>onCellClick(row.category,'ALL')}>{row.total.value>0?fmt_inr(row.total.value):'—'}</td>
                {brands.map(b=>{
                  const cell=row.brands[b]
                  return (
                    <>
                      <td key={b+'q'} style={{ ...S.td, ...NUM, cursor:cell?'pointer':'default', color:cell?'#1a0a2e':'#d8cfe0' }} onClick={()=>cell&&onCellClick(row.category,b)}>{cell?fmt_num(cell.qty):'—'}</td>
                      <td key={b+'v'} style={{ ...S.td, ...NUM, cursor:cell?'pointer':'default', color:cell?'#6b5b7b':'#d8cfe0' }} onClick={()=>cell&&onCellClick(row.category,b)}>{cell&&cell.value>0?fmt_inr(cell.value):cell?'—':''}</td>
                    </>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...S.totalTd, position:'sticky', left:0 }}>GRAND TOTAL</td>
              <td style={{ ...S.totalTd, ...NUM }}>{fmt_num(grand.qty)}</td>
              <td style={{ ...S.totalTd, ...NUM }}>{grand.value>0?fmt_inr(grand.value):'—'}</td>
              {brands.map(b=>{
                const bt = rows.reduce((s:number,row:any)=>s+(row.brands[b]?.qty||0),0)
                const bv = rows.reduce((s:number,row:any)=>s+(row.brands[b]?.value||0),0)
                return (<><td key={b+'q'} style={{ ...S.totalTd, ...NUM }}>{fmt_num(bt)}</td><td key={b+'v'} style={{ ...S.totalTd, ...NUM }}>{bv>0?fmt_inr(bv):'—'}</td></>)
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { selectedBranch } = useBranch()
  const [tab, setTab] = useState<'snapshot'|'aging'|'deepdive'>('snapshot')
  const [drillKey, setDrillKey] = useState<{cat:string;brand:string}|null>(null)

  const [allInventory, setAllInventory] = useState<any[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [vendorMap, setVendorMap] = useState<Record<string,string>>({})

  const loadInventory = useCallback(async () => {
    setInvLoading(true)
    try {
      const data = await fetchAllRows('computed_inventory', 'item_code,product_name,category,brand,qty,cost_per_unit,stock_value,image_url,product_id', q => q.gt('qty', 0), 'item_code')
      setAllInventory(data)
      fetchVendorMap().then(setVendorMap) // full map, since inventory spans the whole catalog
    } finally { setInvLoading(false) }
  }, [])
  useEffect(() => { loadInventory() }, [loadInventory])

  const categoryGroups = useMemo(() => buildCategoryGroups(allInventory.map(r=>r.category)), [allInventory])
  const canonicalCategories = useMemo(() => categoryGroups.map(g=>g.canonical), [categoryGroups])
  const allBrandsList = useMemo(() => [...new Set(allInventory.map(r=>r.brand).filter(Boolean))].sort(), [allInventory])
  const allVendorsList = useMemo(() => [...new Set(Object.values(vendorMap))].sort(), [vendorMap])

  const productsByItemCode = useMemo(() => {
    const map: Record<string, any> = {}
    for (const p of allInventory) {
      const key = p.item_code
      if (!map[key]) map[key] = { ...p, category: normalizeCategory(p.category), qty: 0, stock_value: 0, _batches: 0, vendor: vendorMap[key] || '' }
      map[key].qty += p.qty ?? 0
      map[key].stock_value += stockValueOf(p)
      map[key]._batches += 1
      if (!map[key].image_url && p.image_url) map[key].image_url = p.image_url
    }
    return Object.values(map)
  }, [allInventory, vendorMap])

  // ── Category / Brand / Vendor performance cut ──────────────────────────
  const [cutCategory, setCutCategory] = useState('ALL')
  const [cutBrand, setCutBrand] = useState('ALL')
  const [cutVendor, setCutVendor] = useState('ALL')

  // Filters apply to BOTH the summary cards AND the Stock Snapshot table
  // below -- selecting a category/brand/vendor filters everything on the
  // page consistently, not just the metric cards.
  const filteredProductsByItemCode = useMemo(() => {
    return productsByItemCode.filter((p:any) => {
      if (cutCategory!=='ALL' && p.category!==cutCategory) return false
      if (cutBrand!=='ALL' && (p.brand||'Unknown')!==cutBrand) return false
      if (cutVendor!=='ALL' && (p.vendor||'')!==cutVendor) return false
      return true
    })
  }, [productsByItemCode, cutCategory, cutBrand, cutVendor])

  const drillItems = useMemo(() => {
    if (!drillKey) return []
    return filteredProductsByItemCode.filter((p:any) => {
      if (drillKey.cat!=='ALL' && p.category!==drillKey.cat) return false
      if (drillKey.brand!=='ALL' && (p.brand||'Unknown')!==drillKey.brand) return false
      return true
    }).sort((a:any,b:any)=>b.qty-a.qty)
  }, [filteredProductsByItemCode, drillKey])

  const { grain: cutGrain, offset: cutOffset, setGrain: setCutGrain, setOffset: setCutOffset } = useDateRange()
  const cutRange = getDateRange(cutGrain, cutOffset)
  const [cutSold, setCutSold] = useState({ qty:0, revenue:0 })
  const [cutLoading, setCutLoading] = useState(false)

  const cutStock = useMemo(() => {
    return { qty: filteredProductsByItemCode.reduce((s:number,r:any)=>s+r.qty,0), value: filteredProductsByItemCode.reduce((s:number,r:any)=>s+r.stock_value,0) }
  }, [filteredProductsByItemCode])

  const loadCutSold = useCallback(async () => {
    setCutLoading(true)
    try {
      const sales = await fetchAllRows('sales', 'item_code,category,brand,qty,net_amount', q => {
        let qq = q.gte('date', cutRange.from).lte('date', cutRange.to)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })
      const filtered = sales.filter(r => {
        if (cutCategory!=='ALL' && normalizeCategory(r.category)!==cutCategory) return false
        if (cutBrand!=='ALL' && (r.brand||'Unknown')!==cutBrand) return false
        if (cutVendor!=='ALL' && (vendorMap[r.item_code]||'')!==cutVendor) return false
        return true
      })
      setCutSold({ qty: filtered.reduce((s,r)=>s+(r.qty||0),0), revenue: filtered.reduce((s,r)=>s+(r.net_amount||0),0) })
    } finally { setCutLoading(false) }
  }, [cutCategory, cutBrand, cutVendor, cutRange.from, cutRange.to, selectedBranch, vendorMap])

  useEffect(() => { loadCutSold() }, [loadCutSold])

  // ── Aging tab ────────────────────────────────────────────────────────────
  const [inwardMap, setInwardMap] = useState<Record<string,string>>({})
  const [lifetimeSales, setLifetimeSales] = useState<Record<string,{qty:number,revenue:number}>>({})
  const [agingLoading, setAgingLoading] = useState(false)
  const [agingBucket, setAgingBucket] = useState<string|null>(null)
  const [agingDrillKey, setAgingDrillKey] = useState<{cat:string;brand:string}|null>(null)

  const loadAgingData = useCallback(async () => {
    setAgingLoading(true)
    try {
      const [inward, sales] = await Promise.all([
        fetchAllRows('material_inward', 'item_code,inward_date', q => q),
        fetchAllRows('sales', 'item_code,qty,net_amount', q => q), // lifetime, no date filter -- "till date"
      ])
      const inMap: Record<string,string> = {}
      for (const r of inward) {
        if (!r.inward_date) continue
        if (!inMap[r.item_code] || r.inward_date > inMap[r.item_code]) inMap[r.item_code] = r.inward_date
      }
      setInwardMap(inMap)
      const salesMap: Record<string,{qty:number,revenue:number}> = {}
      for (const r of sales) {
        if (!salesMap[r.item_code]) salesMap[r.item_code] = { qty:0, revenue:0 }
        salesMap[r.item_code].qty += r.qty||0
        salesMap[r.item_code].revenue += r.net_amount||0
      }
      setLifetimeSales(salesMap)
    } finally { setAgingLoading(false) }
  }, [])
  useEffect(() => { if (tab==='aging') loadAgingData() }, [tab, loadAgingData])

  // Every item that currently has stock OR has ever sold — aging looks at
  // the item's full lifecycle, not just what's on the shelf right now.
  const agingItems = useMemo(() => {
    const allCodes = new Set([...productsByItemCode.map((p:any)=>p.item_code), ...Object.keys(lifetimeSales)])
    const stockMap: Record<string,any> = {}
    for (const p of productsByItemCode as any[]) stockMap[p.item_code] = p
    return [...allCodes].map(code => {
      const stock = stockMap[code]
      const inwardDate = inwardMap[code]
      const ageDays = inwardDate ? Math.floor((Date.now() - new Date(inwardDate).getTime())/86400000) : null
      return {
        item_code: code,
        product_name: stock?.product_name, category: stock ? stock.category : 'Other',
        brand: stock?.brand, vendor: stock?.vendor || vendorMap[code] || '',
        image_url: stock?.image_url, product_id: stock?.product_id, cost_per_unit: stock?.cost_per_unit || 0,
        qty: stock?.qty || 0, stock_value: stock?.stock_value || 0, _batches: stock?._batches || 0,
        sold_qty: lifetimeSales[code]?.qty || 0, sold_revenue: lifetimeSales[code]?.revenue || 0,
        age_days: ageDays, bucket: bucketOf(ageDays),
      }
    })
  }, [productsByItemCode, lifetimeSales, inwardMap, vendorMap])

  const bucketSummary = useMemo(() => {
    const map: Record<string, any> = {}
    for (const b of AGE_BUCKETS) map[b] = { bucket:b, sold_qty:0, sold_revenue:0, inv_qty:0, inv_value:0, items:0 }
    for (const it of agingItems) {
      map[it.bucket].sold_qty += it.sold_qty
      map[it.bucket].sold_revenue += it.sold_revenue
      map[it.bucket].inv_qty += it.qty
      map[it.bucket].inv_value += it.stock_value
      map[it.bucket].items += 1
    }
    return AGE_BUCKETS.map(b=>map[b])
  }, [agingItems])

  const agingBucketItems = useMemo(() => agingItems.filter(i=>i.bucket===agingBucket), [agingItems, agingBucket])
  const agingDrillItems = useMemo(() => {
    if (!agingDrillKey) return []
    return agingBucketItems.filter((p:any) => {
      if (agingDrillKey.cat!=='ALL' && p.category!==agingDrillKey.cat) return false
      if (agingDrillKey.brand!=='ALL' && (p.brand||'Unknown')!==agingDrillKey.brand) return false
      return true
    })
  }, [agingBucketItems, agingDrillKey])

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Inventory" subtitle="Live stock snapshot by category and brand"
        actions={
          <div style={{ display:'flex', gap:8 }}>
            {(['snapshot','aging','deepdive'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:`1px solid ${tab===t?'#3b0764':'#e8d5b7'}`, background:tab===t?'#3b0764':'#fff', color:tab===t?'#fff':'#6b5b7b' }}>
                {t==='snapshot'?'📊 Stock Snapshot':t==='aging'?'⏳ Aging':'🔍 Item Deep Dive'}
              </button>
            ))}
          </div>
        }
      />
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:22 }}>

        {tab==='snapshot' && (
        <>
        {/* ═══════════ CATEGORY / BRAND / VENDOR PERFORMANCE CUT ═══════════ */}
        <div style={{ borderRadius:18, overflow:'hidden', border:'1px solid #e8d5b7', boxShadow:'0 4px 16px rgba(59,7,100,0.08)' }}>
          <div style={{ background:'linear-gradient(120deg, #3b0764 0%, #5b21b6 100%)', padding:'16px 22px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Sparkles size={16} color="#fff"/>
            </div>
            <div>
              <h2 className="font-display" style={{ fontSize:16, color:'#fff', margin:0 }}>Category / Brand / Vendor Performance</h2>
              <p style={{ fontSize:11.5, color:'#d4c2f0', margin:'2px 0 0' }}>Units sold in the selected period vs. units still in stock right now</p>
            </div>
          </div>

          <div style={{ background:'#fff', padding:'20px 22px', display:'flex', flexDirection:'column', gap:18 }}>
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:20 }}>
              <FilterSelect icon={Tags} label="Category" value={cutCategory} onChange={setCutCategory} options={canonicalCategories} allLabel="All Categories"/>
              <FilterSelect icon={LayoutGrid} label="Brand" value={cutBrand} onChange={setCutBrand} options={allBrandsList} allLabel="All Brands"/>
              <FilterSelect icon={Truck} label="Vendor" value={cutVendor} onChange={setCutVendor} options={allVendorsList} allLabel="All Vendors"/>
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

        <div>
          <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Stock Snapshot — Category × Brand</h2>
          <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Click any cell for the product list · one row per product (multi-batch items summed) · click a product to open it in VasyERP</p>
        </div>

        {invLoading?<div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>:(
          <CategoryBrandPivot items={filteredProductsByItemCode} onCellClick={(cat,brand)=>setDrillKey({cat,brand})}/>
        )}

        {drillKey&&(
          <ProductDrillTable items={drillItems}
            title={drillKey.cat==='ALL'?'All Products':drillKey.brand==='ALL'?drillKey.cat:`${drillKey.cat} — ${drillKey.brand}`}
            subtitle={`${drillItems.length} products · ${fmt_num(drillItems.reduce((s:number,p:any)=>s+p.qty,0))} units · click a product to open it in VasyERP`}
            onClose={()=>setDrillKey(null)}/>
        )}
        </>
        )}

        {tab==='aging' && (
        <>
        <div>
          <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0, display:'flex', alignItems:'center', gap:8 }}><Clock size={18}/> Inventory Aging</h2>
          <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Age = days since each item's most recent material inward. "Unknown" = no inward record synced for that item. Click a value for the category/brand split.</p>
        </div>

        {agingLoading||invLoading ? (
          <div style={{ height:240, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>
        ) : (
          <div style={S.section}>
            <div style={{ overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr>
                  <th style={S.th}>Age Bucket</th>
                  <th style={{...S.th, textAlign:'right'}}>Items</th>
                  <th style={{...S.th, textAlign:'right'}}>Sold Units (till date)</th>
                  <th style={{...S.th, textAlign:'right'}}>GMS / Revenue (till date)</th>
                  <th style={{...S.th, textAlign:'right'}}>In Stock Now</th>
                  <th style={{...S.th, textAlign:'right'}}>Stock Value Now</th>
                </tr></thead>
                <tbody>
                  {bucketSummary.map((b,i)=>(
                    <tr key={b.bucket} className="inv-row" style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>{b.bucket}</td>
                      <td style={{ ...S.td, ...NUM, color:'#6b5b7b' }}>{fmt_num(b.items)}</td>
                      <td style={{ ...S.td, ...NUM, cursor:b.sold_qty>0?'pointer':'default' }} onClick={()=>b.sold_qty>0&&setAgingBucket(b.bucket)}>{fmt_num(b.sold_qty)}</td>
                      <td style={{ ...S.td, ...NUM, cursor:b.sold_revenue>0?'pointer':'default', color:'#059669', fontWeight:600 }} onClick={()=>b.sold_revenue>0&&setAgingBucket(b.bucket)}>{b.sold_revenue>0?fmt_inr(b.sold_revenue):'—'}</td>
                      <td style={{ ...S.td, ...NUM, fontWeight:700, cursor:b.inv_qty>0?'pointer':'default' }} onClick={()=>b.inv_qty>0&&setAgingBucket(b.bucket)}>{fmt_num(b.inv_qty)}</td>
                      <td style={{ ...S.td, ...NUM, cursor:b.inv_value>0?'pointer':'default' }} onClick={()=>b.inv_value>0&&setAgingBucket(b.bucket)}>{b.inv_value>0?fmt_inr(b.inv_value):'—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={S.totalTd}>GRAND TOTAL</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{fmt_num(bucketSummary.reduce((s,b)=>s+b.items,0))}</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{fmt_num(bucketSummary.reduce((s,b)=>s+b.sold_qty,0))}</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{fmt_inr(bucketSummary.reduce((s,b)=>s+b.sold_revenue,0))}</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{fmt_num(bucketSummary.reduce((s,b)=>s+b.inv_qty,0))}</td>
                    <td style={{ ...S.totalTd, ...NUM }}>{fmt_inr(bucketSummary.reduce((s,b)=>s+b.inv_value,0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {agingBucket&&(
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 className="font-display" style={{ color:'#3b0764', fontSize:16, margin:0 }}>{agingBucket} — Category × Brand</h3>
              <button onClick={()=>{setAgingBucket(null);setAgingDrillKey(null)}} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:'pointer', color:'#6b5b7b' }}>Close ×</button>
            </div>
            <CategoryBrandPivot items={agingBucketItems} onCellClick={(cat,brand)=>setAgingDrillKey({cat,brand})}/>
            {agingDrillKey&&(
              <ProductDrillTable items={agingDrillItems}
                title={agingDrillKey.cat==='ALL'?`All Products — ${agingBucket}`:agingDrillKey.brand==='ALL'?`${agingDrillKey.cat} — ${agingBucket}`:`${agingDrillKey.cat} — ${agingDrillKey.brand} — ${agingBucket}`}
                subtitle={`${agingDrillItems.length} products in this age bucket · click a product to open it in VasyERP`}
                onClose={()=>setAgingDrillKey(null)}/>
            )}
          </div>
        )}
        </>
        )}

        {tab==='deepdive' && <ItemDeepDive/>}
      </div>
    </div>
  )
}
