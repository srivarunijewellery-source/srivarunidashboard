'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'
import { fmt_inr, fmt_num, getPeriods, getAllMonths, getDateRange, DATA_START, parseDate, type Grain } from '@/lib/utils'
import { useDateRange } from '@/lib/date-range-context'
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

const S = {
  section: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', overflow: 'hidden' },
}
const PAGE_SIZE = 25
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

export default function SalesPage() {
  const { selectedBranch } = useBranch()
  const [view, setView] = useState<'summary' | 'details'>('details')

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

  // ── Details state (moved from Inventory → Sold Items) ──────────────────────
  const { grain: dGrain, offset: dOffset, setGrain: setDGrain, setOffset: setDOffset } = useDateRange()
  const [page, setPage] = useState(0)
  const [soldItems, setSoldItems] = useState<any[]>([])
  const [dMetrics, setDMetrics] = useState({ revenue:0, profit:0, qty:0, products:0, customers:0, bills:0 })
  const [dLoading, setDLoading] = useState(false)

  const dateRange = getDateRange(dGrain, dOffset)

  const loadDetails = useCallback(async () => {
    setDLoading(true); setPage(0)
    try {
      const sales = await fetchAllRows('sales', 'item_code,product_name,category,brand,selling_price,landing_cost,mrp,qty,net_amount,profit,voucher_no,mobile_no,customer_name', q => {
        let qq = q.gte('date', dateRange.from).lte('date', dateRange.to)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })
      if (!sales.length) { setSoldItems([]); setDMetrics({revenue:0,profit:0,qty:0,products:0,customers:0,bills:0}); return }

      const agg: Record<string,any> = {}
      const custSet = new Set<string>()
      const billSet = new Set<string>()
      for (const s of sales) {
        if (!agg[s.item_code]) agg[s.item_code] = { ...s, qty_sold:0, revenue:0, profit:0 }
        agg[s.item_code].qty_sold += s.qty||0
        agg[s.item_code].revenue  += s.net_amount||0
        agg[s.item_code].profit   += s.profit||0
        custSet.add(s.mobile_no || s.customer_name || 'unknown')
        billSet.add(s.voucher_no)
      }
      const codes = Object.keys(agg)

      const { data: inv } = await supabase.from('inventory_with_cost')
        .select('item_code,image_url,qty,synced_at,cost_per_unit,product_id').in('item_code', codes.slice(0,500))
      const { data: purch } = await supabase.from('purchases')
        .select('item_code,supplier_name').in('item_code', codes.slice(0,500)).limit(2000)

      const invMap: Record<string,any> = {}; for (const p of inv||[]) invMap[p.item_code] = p
      const venMap: Record<string,string> = {}; for (const p of purch||[]) { if (!venMap[p.item_code]) venMap[p.item_code] = p.supplier_name }

      const items = Object.values(agg).map((i:any) => ({
        ...i,
        image_url:    invMap[i.item_code]?.image_url || '',
        qty_remaining: invMap[i.item_code]?.qty ?? 0,
        vendor:       venMap[i.item_code],
        landing_cost: i.landing_cost || invMap[i.item_code]?.cost_per_unit || 0,
        product_id:   invMap[i.item_code]?.product_id,
      })).sort((a:any,b:any) => b.revenue - a.revenue)

      setSoldItems(items)
      setDMetrics({
        revenue: items.reduce((s:number,i:any)=>s+i.revenue,0),
        profit: items.reduce((s:number,i:any)=>s+i.profit,0),
        qty: items.reduce((s:number,i:any)=>s+i.qty_sold,0),
        products: items.length,
        customers: custSet.size,
        bills: billSet.size,
      })
    } finally { setDLoading(false) }
  }, [dateRange.from, dateRange.to, selectedBranch])

  useEffect(() => { if (view==='details') loadDetails() }, [view, loadDetails])

  const pageItems = soldItems.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
  const totalPages = Math.ceil(soldItems.length/PAGE_SIZE)
  const dMargin = dMetrics.revenue>0?dMetrics.profit/dMetrics.revenue*100:0

  // ── Modals ───────────────────────────────────────────────────────────────
  const [orderVoucher, setOrderVoucher] = useState<string|null>(null)
  const [showBills, setShowBills] = useState(false)
  const [showCustomers, setShowCustomers] = useState(false)

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Sales" subtitle="Revenue, profitability and per-product detail"
        actions={
          <div style={{ display:'flex', gap:8 }}>
            {(['summary','details'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{ padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:`1px solid ${view===v?'#3b0764':'#e8d5b7'}`, background:view===v?'#3b0764':'#fff', color:view===v?'#fff':'#6b5b7b' }}>
                {v==='summary'?'📊 Summary':'🔍 Details'}
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

        {view==='details' && (
          <>
            <DateNav grain={dGrain} onGrainChange={setDGrain} offset={dOffset} onOffsetChange={setDOffset} label={dateRange.label} />

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
      </div>

      {orderVoucher && <OrderModal voucherNo={orderVoucher} onClose={()=>setOrderVoucher(null)} />}
      {showBills && <BillsListModal from={dateRange.from} to={dateRange.to} label={dateRange.label} branchId={selectedBranch} onClose={()=>setShowBills(false)} onOpenOrder={(v)=>{setShowBills(false);setOrderVoucher(v)}} />}
      {showCustomers && <CustomersListModal from={dateRange.from} to={dateRange.to} label={dateRange.label} branchId={selectedBranch} onClose={()=>setShowCustomers(false)} />}
    </div>
  )
}
