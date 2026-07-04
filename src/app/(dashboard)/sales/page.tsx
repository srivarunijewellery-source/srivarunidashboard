'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'
import { fmt_inr, fmt_num, getPeriods, getAllMonths, getDateRange, normalizeCategory, DATA_START, parseDate, type Grain } from '@/lib/utils'
import { useDateRange } from '@/lib/date-range-context'
import { useSortable } from '@/lib/useSortable'
import SortIndicator from '@/components/ui/SortIndicator'
import PageHeader from '@/components/layout/PageHeader'
import GrainSelector from '@/components/ui/GrainSelector'
import DateNav from '@/components/ui/DateNav'
import MetricCard from '@/components/ui/MetricCard'
import ProductCard from '@/components/inventory/ProductCard'
import OrderModal from '@/components/ui/OrderModal'
import BillsListModal from '@/components/ui/BillsListModal'
import CustomersListModal from '@/components/ui/CustomersListModal'
import { format, startOfWeek } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts'
import { ChevronDown, X, Truck } from 'lucide-react'

const S = {
  section: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', overflow: 'hidden' },
  th: { padding:'9px 12px', fontSize:10, fontWeight:700, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.6, background:'#f5f0e8', borderBottom:'2px solid #e8d5b7', borderRight:'1px solid #ece1cc', whiteSpace:'nowrap' as const },
  td: { padding:'7px 12px', fontSize:12.5, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8', borderRight:'1px solid #f5f0e8', whiteSpace:'nowrap' as const },
  totalTd: { padding:'8px 12px', fontSize:12.5, color:'#3b0764', borderTop:'2px solid #7c3aed', borderRight:'1px solid #ded0f5', whiteSpace:'nowrap' as const, fontWeight:700, background:'#f5f0ff' },
}
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }
const PAGE_SIZE = 25
const DRILL_PAGE_SIZE = 30
const N: Record<Grain, number> = { day: 14, week: 8, month: 8, quarter: 6, year: 5 }

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e8d5b7', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(59,7,100,0.12)', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: '#3b0764', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ color: p.color, fontWeight: 700 }}>■</span>
          <span style={{ color: '#6b5b7b' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: '#1a0a2e' }}>{p.name === 'Qty' ? fmt_num(p.value) : fmt_inr(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function VendorFilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const isActive = value !== 'ALL'
  return (
    <div>
      <label style={{ fontSize:10, color:'#8b7d97', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
        <Truck size={11}/> Vendor
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
          <option value="ALL">All Vendors</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:isActive?'#7c3aed':'#a99bb8', pointerEvents:'none' }}/>
        {isActive && (
          <button onClick={()=>onChange('ALL')} title="Clear vendor" style={{
            position:'absolute', right:-8, top:-8, width:18, height:18, borderRadius:'50%',
            background:'#7c3aed', color:'#fff', border:'2px solid #fff', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', padding:0,
          }}><X size={10}/></button>
        )}
      </div>
    </div>
  )
}

export default function SalesPage() {
  const { selectedBranch } = useBranch()
  const [view, setView] = useState<'summary' | 'details' | 'category'>('details')

  // ── Summary state ────────────────────────────────────────────────────────
  const [grain, setGrain] = useState<Grain>('month')
  const [chartData, setChartData] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ revenue: 0, profit: 0, qty: 0 })
  const [loading, setLoading] = useState(false)

  const loadChart = useCallback(async () => {
    setLoading(true)
    try {
      const periods = grain === 'month' ? getAllMonths() : getPeriods(grain, N[grain])
      const data = await fetchAllRows('sales', 'date,net_amount,profit,qty', q => {
        let qq = q.gte('date', DATA_START).lte('date', new Date().toISOString().split('T')[0])
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })

      const buckets: Record<string, any> = {}
      periods.forEach(p => { buckets[p.label] = { label: p.label, revenue: 0, profit: 0, qty: 0 } })

      for (const row of data) {
        const d = parseDate(row.date)
        let lbl = ''
        if (grain === 'day') lbl = format(d, 'dd MMM')
        else if (grain === 'week') lbl = format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM')
        else if (grain === 'month') lbl = format(d, 'MMM yy')
        else if (grain === 'year') lbl = format(d, 'yyyy')
        else lbl = `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`
        if (buckets[lbl]) {
          buckets[lbl].revenue += row.net_amount||0
          buckets[lbl].profit  += row.profit||0
          buckets[lbl].qty     += row.qty||0
        }
      }

      const pts = periods.map(p => buckets[p.label]).filter(p => p.revenue > 0)
      setChartData(pts)
      setMetrics({ revenue: pts.reduce((s,p)=>s+p.revenue,0), profit: pts.reduce((s,p)=>s+p.profit,0), qty: pts.reduce((s,p)=>s+p.qty,0) })
    } finally { setLoading(false) }
  }, [grain, selectedBranch])

  useEffect(() => { if (view==='summary') loadChart() }, [loadChart, view])

  const last = chartData[chartData.length-1], prev = chartData[chartData.length-2]
  const delta = prev?.revenue > 0 ? ((last?.revenue||0)-prev.revenue)/prev.revenue*100 : 0
  const margin = metrics.revenue > 0 ? metrics.profit/metrics.revenue*100 : 0

  // ── Details + Category Summary share the same date range and the same
  //    underlying sold-items dataset — Category Summary is just a
  //    different aggregation (category x brand) of the same data, so it
  //    reuses `soldItems` instead of a second fetch. ─────────────────────
  const { grain: dGrain, offset: dOffset, setGrain: setDGrain, setOffset: setDOffset } = useDateRange()
  const [page, setPage] = useState(0)
  const [soldItems, setSoldItems] = useState<any[]>([])
  const [dLoading, setDLoading] = useState(false)
  const [vendorFilter, setVendorFilter] = useState('ALL')

  const dateRange = getDateRange(dGrain, dOffset)

  const loadDetails = useCallback(async () => {
    setDLoading(true); setPage(0)
    try {
      const sales = await fetchAllRows('sales', 'item_code,product_name,category,brand,selling_price,landing_cost,mrp,qty,net_amount,profit,voucher_no,mobile_no,customer_name', q => {
        let qq = q.gte('date', dateRange.from).lte('date', dateRange.to)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })
      if (!sales.length) { setSoldItems([]); return }

      const agg: Record<string,any> = {}
      for (const s of sales) {
        if (!agg[s.item_code]) agg[s.item_code] = { ...s, category: normalizeCategory(s.category), qty_sold:0, revenue:0, profit:0, customers: new Set<string>(), bills: new Set<string>() }
        agg[s.item_code].qty_sold += s.qty||0
        agg[s.item_code].revenue  += s.net_amount||0
        agg[s.item_code].profit   += s.profit||0
        agg[s.item_code].customers.add(s.mobile_no || s.customer_name || 'unknown')
        agg[s.item_code].bills.add(s.voucher_no)
      }
      const codes = Object.keys(agg)

      const { data: inv } = await supabase.from('computed_inventory')
        .select('item_code,image_url,qty,cost_per_unit,product_id').in('item_code', codes.slice(0,500))
      const { data: purch } = await supabase.from('purchases')
        .select('item_code,supplier_name').in('item_code', codes.slice(0,500)).limit(2000)

      const invMap: Record<string,any> = {}; for (const p of inv||[]) invMap[p.item_code] = p
      const venMap: Record<string,string> = {}; for (const p of purch||[]) { if (!venMap[p.item_code]) venMap[p.item_code] = p.supplier_name }

      const items = Object.values(agg).map((i:any) => ({
        ...i,
        image_url:    invMap[i.item_code]?.image_url || '',
        qty_remaining: invMap[i.item_code]?.qty ?? 0,
        vendor:       venMap[i.item_code] || '',
        landing_cost: i.landing_cost || invMap[i.item_code]?.cost_per_unit || 0,
        product_id:   invMap[i.item_code]?.product_id,
      })).sort((a:any,b:any) => b.revenue - a.revenue)

      setSoldItems(items)
    } finally { setDLoading(false) }
  }, [dateRange.from, dateRange.to, selectedBranch])

  useEffect(() => { if (view==='details' || view==='category') loadDetails() }, [view, loadDetails])

  const allVendorsList = useMemo(() => [...new Set(soldItems.map(i=>i.vendor).filter(Boolean))].sort(), [soldItems])
  const filteredSoldItems = useMemo(() => vendorFilter==='ALL' ? soldItems : soldItems.filter(i=>i.vendor===vendorFilter), [soldItems, vendorFilter])

  const dMetrics = useMemo(() => ({
    revenue: filteredSoldItems.reduce((s:number,i:any)=>s+i.revenue,0),
    profit: filteredSoldItems.reduce((s:number,i:any)=>s+i.profit,0),
    qty: filteredSoldItems.reduce((s:number,i:any)=>s+i.qty_sold,0),
    products: filteredSoldItems.length,
    customers: new Set(filteredSoldItems.flatMap((i:any)=>[...i.customers])).size,
    bills: new Set(filteredSoldItems.flatMap((i:any)=>[...i.bills])).size,
  }), [filteredSoldItems])

  const pageItems = filteredSoldItems.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
  const totalPages = Math.ceil(filteredSoldItems.length/PAGE_SIZE)
  const dMargin = dMetrics.revenue>0?dMetrics.profit/dMetrics.revenue*100:0

  // ── Category Summary pivot (category x brand, sourced from filteredSoldItems) ──
  const [catDrillKey, setCatDrillKey] = useState<{cat:string;brand:string}|null>(null)
  const [catColSortDir, setCatColSortDir] = useState<'asc'|'desc'>('desc')
  const { rows: catPivotRows, brandTotals: catBrandTotals } = useMemo(() => {
    const map: Record<string, any> = {}
    const brandTotals: Record<string, number> = {}
    for (const i of filteredSoldItems) {
      const cat = i.category, br = i.brand || 'Unknown'
      brandTotals[br] = (brandTotals[br]||0) + i.qty_sold
      if (!map[cat]) map[cat] = { category:cat, total:{qty:0,revenue:0}, brands:{} }
      map[cat].total.qty += i.qty_sold; map[cat].total.revenue += i.revenue
      if (!map[cat].brands[br]) map[cat].brands[br] = { qty:0, revenue:0 }
      map[cat].brands[br].qty += i.qty_sold; map[cat].brands[br].revenue += i.revenue
    }
    return { rows: Object.values(map).sort((a:any,b:any)=>b.total.qty-a.total.qty), brandTotals }
  }, [filteredSoldItems])
  const catBrands = useMemo(() => Object.keys(catBrandTotals).sort((a,b)=> catColSortDir==='desc' ? catBrandTotals[b]-catBrandTotals[a] : catBrandTotals[a]-catBrandTotals[b]), [catBrandTotals, catColSortDir])
  const catPivotGetValue = useCallback((row: any, key: string) => {
    if (key === 'category') return row.category
    if (key === 'total_qty') return row.total.qty
    if (key === 'total_revenue') return row.total.revenue
    const [, brand, field] = key.split('::')
    return row.brands[brand]?.[field] ?? -1
  }, [])
  const { sorted: sortedCatPivotRows, sortKey: catSortKey, sortDir: catSortDir, toggleSort: toggleCatSort } = useSortable(catPivotRows, catPivotGetValue)
  const catGrandTotal = useMemo(() => ({ qty: filteredSoldItems.reduce((s,i)=>s+i.qty_sold,0), revenue: filteredSoldItems.reduce((s,i)=>s+i.revenue,0) }), [filteredSoldItems])

  const catDrillItems = useMemo(() => {
    if (!catDrillKey) return []
    return filteredSoldItems.filter((i:any) => {
      if (catDrillKey.cat!=='ALL' && i.category!==catDrillKey.cat) return false
      if (catDrillKey.brand!=='ALL' && (i.brand||'Unknown')!==catDrillKey.brand) return false
      return true
    }).sort((a:any,b:any)=>b.revenue-a.revenue)
  }, [filteredSoldItems, catDrillKey])
  const [catDrillPage, setCatDrillPage] = useState(0)
  const [catDrillSortField, setCatDrillSortField] = useState('revenue')
  const [catDrillSortDir, setCatDrillSortDir] = useState<'asc'|'desc'>('desc')
  useEffect(() => { setCatDrillPage(0) }, [catDrillKey])
  const sortedCatDrillItems = useMemo(() => {
    return [...catDrillItems].sort((a:any,b:any) => {
      const av = a[catDrillSortField], bv = b[catDrillSortField]
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av||0)-(bv||0)
      return catDrillSortDir==='asc' ? cmp : -cmp
    })
  }, [catDrillItems, catDrillSortField, catDrillSortDir])
  const catDrillPageItems = sortedCatDrillItems.slice(catDrillPage*DRILL_PAGE_SIZE, (catDrillPage+1)*DRILL_PAGE_SIZE)
  const catDrillTotalPages = Math.ceil(sortedCatDrillItems.length/DRILL_PAGE_SIZE)

  // ── Modals ───────────────────────────────────────────────────────────────
  const [orderVoucher, setOrderVoucher] = useState<string|null>(null)
  const [showBills, setShowBills] = useState(false)
  const [showCustomers, setShowCustomers] = useState(false)

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Sales" subtitle="Revenue, profitability and per-product detail"
        actions={
          <div style={{ display:'flex', gap:8 }}>
            {(['summary','details','category'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:`1px solid ${view===v?'#3b0764':'#e8d5b7'}`, background:view===v?'#3b0764':'#fff', color:view===v?'#fff':'#6b5b7b' }}>
                {v==='summary'?'📊 Summary':v==='details'?'🔍 Details':'🗂️ Category Summary'}
              </button>
            ))}
          </div>
        }
      />
      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {view==='summary' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <GrainSelector value={grain} onChange={g => setGrain(g)} />
              <p style={{ fontSize: 12, color: '#6b5b7b' }}>All available data · Dec 2025 – present</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              <MetricCard label="Total Revenue" value={fmt_inr(metrics.revenue)} accent="purple"
                delta={delta !== 0 ? { value: `${Math.abs(delta).toFixed(1)}% vs prev`, positive: delta >= 0 } : undefined} />
              <MetricCard label="Total Profit" value={fmt_inr(metrics.profit)} sub={`${margin.toFixed(1)}% margin`} accent="green" />
              <MetricCard label="Units Sold" value={fmt_num(metrics.qty)} accent="beige" />
              <MetricCard label={`Avg/${grain}`} value={fmt_inr(chartData.length ? metrics.revenue/chartData.length : 0)} accent="beige" />
            </div>

            <div style={{ ...S.section, padding: 24 }}>
              <h2 className="font-display" style={{ color: '#3b0764', fontSize: 18, margin: '0 0 20px' }}>Revenue & Profit by {grain.charAt(0).toUpperCase()+grain.slice(1)}</h2>
              {loading ? <div style={{ height: 280, background: '#f5f0e8', borderRadius: 12 }} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar yAxisId="l" dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[4,4,0,0]} />
                    <Bar yAxisId="l" dataKey="profit" name="Profit" fill="#c4b5fd" radius={[4,4,0,0]} />
                    <Line yAxisId="r" type="monotone" dataKey="qty" name="Qty" stroke="#f59e0b" strokeWidth={2} dot={{ r:3, fill:'#f59e0b' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}

        {(view==='details' || view==='category') && (
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:20, justifyContent:'space-between' }}>
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-end', gap:20 }}>
              <VendorFilterSelect value={vendorFilter} onChange={setVendorFilter} options={allVendorsList}/>
            </div>
            <DateNav grain={dGrain} onGrainChange={setDGrain} offset={dOffset} onOffsetChange={setDOffset} label={dateRange.label} />
          </div>
        )}

        {view==='details' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14 }}>
              <MetricCard label="Revenue" value={fmt_inr(dMetrics.revenue)} sub={dateRange.label} accent="purple" onClick={()=>setShowBills(true)}/>
              <MetricCard label="Profit" value={fmt_inr(dMetrics.profit)} sub={`${dMargin.toFixed(1)}% margin`} accent="green"/>
              <MetricCard label="Units Sold" value={fmt_num(dMetrics.qty)} accent="beige" onClick={()=>setShowBills(true)}/>
              <MetricCard label="Unique Products" value={fmt_num(dMetrics.products)} accent="beige"/>
              <MetricCard label="Customers Visited" value={fmt_num(dMetrics.customers)} accent="beige" onClick={()=>setShowCustomers(true)}/>
              <MetricCard label="Bills Generated" value={fmt_num(dMetrics.bills)} accent="beige" onClick={()=>setShowBills(true)}/>
            </div>

            {dLoading ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
                {Array.from({length:10}).map((_,i)=><div key={i} style={{ borderRadius:16, background:'#fff', aspectRatio:'3/4', border:'1px solid #e8d5b7' }}/>)}
              </div>
            ) : filteredSoldItems.length===0 ? (
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
                    <span style={{ fontSize:13, color:'#6b5b7b' }}>{page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,filteredSoldItems.length)} of {filteredSoldItems.length}</span>
                    <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:13, cursor:page>=totalPages-1?'default':'pointer', color:page>=totalPages-1?'#ccc':'#3b0764' }}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {view==='category' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              <MetricCard label="Units Sold" value={fmt_num(catGrandTotal.qty)} sub={dateRange.label} accent="purple"/>
              <MetricCard label="Revenue" value={fmt_inr(catGrandTotal.revenue)} sub={dateRange.label} accent="green"/>
              <MetricCard label="Categories" value={`${catPivotRows.length}`} accent="beige"/>
            </div>

            {dLoading ? <div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/> : (
            <div style={S.section}>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:12, color:'#6b5b7b', margin:0 }}>Click any cell for the sold-items list</p>
                <button onClick={()=>setCatColSortDir(d=>d==='desc'?'asc':'desc')} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8, cursor:'pointer', border:'1px solid #e8d5b7', background:'#fff', fontSize:11, fontWeight:600, color:'#3b0764' }}>
                  Brands: {catColSortDir==='desc'?'High → Low':'Low → High'}<SortIndicator active dir={catColSortDir}/>
                </button>
              </div>
              <div style={{ overflow:'auto', maxHeight:460 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr>
                      <th onClick={()=>toggleCatSort('category')} style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, top:0, minWidth:140, zIndex:3, cursor:'pointer' }}>Category<SortIndicator active={catSortKey==='category'} dir={catSortDir}/></th>
                      <th colSpan={2} style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'center', position:'sticky', top:0, zIndex:2 }}>TOTAL</th>
                      {catBrands.map(b=><th key={b} colSpan={2} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'center', minWidth:120, position:'sticky', top:0, zIndex:1 }}>{b}</th>)}
                    </tr>
                    <tr>
                      <th style={{ ...S.th, background:'#2a044a', position:'sticky', left:0, top:32, zIndex:3 }}></th>
                      <th onClick={()=>toggleCatSort('total_qty')} style={{ ...S.th, background:'#3b0764', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:2, cursor:'pointer' }}>Qty<SortIndicator active={catSortKey==='total_qty'} dir={catSortDir}/></th>
                      <th onClick={()=>toggleCatSort('total_revenue')} style={{ ...S.th, background:'#3b0764', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:2, cursor:'pointer' }}>Revenue<SortIndicator active={catSortKey==='total_revenue'} dir={catSortDir}/></th>
                      {catBrands.map(b=>(
                        <>
                          <th key={b+'q'} onClick={()=>toggleCatSort(`brand::${b}::qty`)} style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:1, cursor:'pointer' }}>Qty<SortIndicator active={catSortKey===`brand::${b}::qty`} dir={catSortDir}/></th>
                          <th key={b+'v'} onClick={()=>toggleCatSort(`brand::${b}::revenue`)} style={{ ...S.th, background:'#2a044a', color:'#c4b5fd', textAlign:'right', fontSize:9.5, position:'sticky', top:32, zIndex:1, cursor:'pointer' }}>Revenue<SortIndicator active={catSortKey===`brand::${b}::revenue`} dir={catSortDir}/></th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCatPivotRows.map((row:any,ri)=>(
                      <tr key={row.category} className="inv-row" style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                        <td style={{ ...S.td, color:'#3b0764', fontWeight:700, position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff', cursor:'pointer' }} onClick={()=>setCatDrillKey({cat:row.category,brand:'ALL'})}>{row.category}</td>
                        <td style={{ ...S.td, ...NUM, fontWeight:700, cursor:'pointer' }} onClick={()=>setCatDrillKey({cat:row.category,brand:'ALL'})}>{fmt_num(row.total.qty)}</td>
                        <td style={{ ...S.td, ...NUM, cursor:'pointer', color:'#059669', fontWeight:600 }} onClick={()=>setCatDrillKey({cat:row.category,brand:'ALL'})}>{row.total.revenue>0?fmt_inr(row.total.revenue):'—'}</td>
                        {catBrands.map(b=>{
                          const cell=row.brands[b]
                          return (
                            <>
                              <td key={b+'q'} style={{ ...S.td, ...NUM, cursor:cell?'pointer':'default', color:cell?'#1a0a2e':'#d8cfe0' }} onClick={()=>cell&&setCatDrillKey({cat:row.category,brand:b})}>{cell?fmt_num(cell.qty):'—'}</td>
                              <td key={b+'v'} style={{ ...S.td, ...NUM, cursor:cell?'pointer':'default', color:cell?'#059669':'#d8cfe0' }} onClick={()=>cell&&setCatDrillKey({cat:row.category,brand:b})}>{cell&&cell.revenue>0?fmt_inr(cell.revenue):cell?'—':''}</td>
                            </>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...S.totalTd, position:'sticky', left:0 }}>GRAND TOTAL</td>
                      <td style={{ ...S.totalTd, ...NUM }}>{fmt_num(catGrandTotal.qty)}</td>
                      <td style={{ ...S.totalTd, ...NUM }}>{catGrandTotal.revenue>0?fmt_inr(catGrandTotal.revenue):'—'}</td>
                      {catBrands.map(b=>{
                        const bq = catPivotRows.reduce((s:number,row:any)=>s+(row.brands[b]?.qty||0),0)
                        const bv = catPivotRows.reduce((s:number,row:any)=>s+(row.brands[b]?.revenue||0),0)
                        return (<><td key={b+'q'} style={{ ...S.totalTd, ...NUM }}>{fmt_num(bq)}</td><td key={b+'v'} style={{ ...S.totalTd, ...NUM }}>{bv>0?fmt_inr(bv):'—'}</td></>)
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            )}

            {catDrillKey&&(
              <div style={S.section}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <h3 className="font-display" style={{ color:'#3b0764', margin:0, fontSize:15 }}>
                      {catDrillKey.cat==='ALL'?'All Sold Items':catDrillKey.brand==='ALL'?catDrillKey.cat:`${catDrillKey.cat} — ${catDrillKey.brand}`}
                    </h3>
                    <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{catDrillItems.length} items · {fmt_num(catDrillItems.reduce((s:number,i:any)=>s+i.qty_sold,0))} units sold · {dateRange.label}</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <select value={catDrillSortField} onChange={e=>setCatDrillSortField(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:12, color:'#3b0764', background:'#fff' }}>
                      <option value="revenue">Sort: Revenue</option>
                      <option value="qty_sold">Sort: Qty Sold</option>
                      <option value="profit">Sort: Profit</option>
                      <option value="product_name">Sort: Product Name</option>
                      <option value="brand">Sort: Brand</option>
                      <option value="vendor">Sort: Vendor</option>
                    </select>
                    <button onClick={()=>setCatDrillSortDir(d=>d==='desc'?'asc':'desc')} title="Flip sort direction" style={{ padding:'6px 8px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', display:'flex', color:'#3b0764' }}>
                      <SortIndicator active dir={catDrillSortDir}/>
                    </button>
                    <button onClick={()=>setCatDrillKey(null)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:'pointer', color:'#6b5b7b' }}>Close ×</button>
                  </div>
                </div>
                <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
                  {catDrillPageItems.map((item:any)=><ProductCard key={item.item_code} {...item}/>)}
                </div>
                {catDrillTotalPages>1&&(
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'0 0 16px' }}>
                    <button onClick={()=>setCatDrillPage(p=>Math.max(0,p-1))} disabled={catDrillPage===0} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:catDrillPage===0?'default':'pointer', color:catDrillPage===0?'#ccc':'#3b0764' }}>← Prev</button>
                    <span style={{ fontSize:12, color:'#6b5b7b' }}>{catDrillPage*DRILL_PAGE_SIZE+1}–{Math.min((catDrillPage+1)*DRILL_PAGE_SIZE,sortedCatDrillItems.length)} of {sortedCatDrillItems.length}</span>
                    <button onClick={()=>setCatDrillPage(p=>Math.min(catDrillTotalPages-1,p+1))} disabled={catDrillPage>=catDrillTotalPages-1} style={{ padding:'6px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:catDrillPage>=catDrillTotalPages-1?'default':'pointer', color:catDrillPage>=catDrillTotalPages-1?'#ccc':'#3b0764' }}>Next →</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {orderVoucher && <OrderModal voucherNo={orderVoucher} onClose={()=>setOrderVoucher(null)} />}
      {showBills && <BillsListModal from={dateRange.from} to={dateRange.to} label={dateRange.label} branchId={selectedBranch} onClose={()=>setShowBills(false)} onOpenOrder={(v)=>{setShowBills(false);setOrderVoucher(v)}} />}
      {showCustomers && <CustomersListModal from={dateRange.from} to={dateRange.to} label={dateRange.label} branchId={selectedBranch} onClose={()=>setShowCustomers(false)} />}
    </div>
  )
}
