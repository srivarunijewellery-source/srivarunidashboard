'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { fmt_inr, fmt_num, getDateRange, parseDate, DATA_START, normalizeCategory } from '@/lib/utils'
import { useBranch } from '@/lib/branch-context'
import { useDateRange } from '@/lib/date-range-context'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import DateNav from '@/components/ui/DateNav'
import MetricCard from '@/components/ui/MetricCard'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const PURPLE = ['#3b0764','#6d28d9','#7c3aed','#a78bfa','#c4b5fd','#ede9ff']

const S = {
  card: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', padding: 24 },
  section: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', overflow: 'hidden' },
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: 12, color: '#1a0a2e', borderBottom: '1px solid #f0e8d8' },
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e8d5b7', borderRadius: 12, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: '#3b0764', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: p.color }}>■</span>
          <span style={{ color: '#6b5b7b' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.name === 'Qty' ? fmt_num(p.value) : fmt_inr(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function OverviewPage() {
  const { selectedBranch } = useBranch()
  const { grain, offset, setGrain, setOffset } = useDateRange()
  const dateRange = getDateRange(grain, offset)

  const [metrics, setMetrics] = useState({ revenue: 0, profit: 0, qty: 0, customers: 0, bills: 0, margin: 0 })
  const [trendData, setTrendData] = useState<any[]>([])
  const [catData, setCatData] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Period-scoped sales
      const sales = await fetchAllRows('sales', 'date,net_amount,profit,qty,category,voucher_no,mobile_no,customer_name', q => {
        let qq = q.gte('date', dateRange.from).lte('date', dateRange.to)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })

      const totalRev = sales.reduce((s,r)=>s+(r.net_amount||0), 0)
      const totalPro = sales.reduce((s,r)=>s+(r.profit||0), 0)
      const totalQty = sales.reduce((s,r)=>s+(r.qty||0), 0)

      setMetrics({
        revenue: totalRev, profit: totalPro, qty: totalQty,
        customers: new Set(sales.map(s=>s.mobile_no||s.customer_name).filter(Boolean)).size,
        bills: new Set(sales.map(s=>s.voucher_no)).size,
        margin: totalRev>0?totalPro/totalRev*100:0,
      })

      // Category breakdown for the selected period
      const cats: Record<string,number> = {}
      for (const r of sales) { const c=normalizeCategory(r.category); cats[c]=(cats[c]||0)+(r.net_amount||0) }
      const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6)
      setCatData(sorted.map(([name,value])=>({name,value})))

      // Top customers for the selected period
      const custMap: Record<string,any> = {}
      for (const r of sales) {
        const key = r.mobile_no || r.customer_name || 'unknown'
        if (!custMap[key]) custMap[key] = { customer_name: r.customer_name||'Walk-in', mobile_no: r.mobile_no, visit_count:0, total_spend:0, vouchers:new Set<string>() }
        custMap[key].vouchers.add(r.voucher_no)
        custMap[key].total_spend += r.net_amount||0
      }
      const custList = Object.values(custMap).map((c:any)=>({ ...c, visit_count:c.vouchers.size })).sort((a:any,b:any)=>b.total_spend-a.total_spend).slice(0,10)
      setTopCustomers(custList)

      // Low stock — always live/current, not period-scoped
      const { data: inv } = await supabase.from('inventory_with_cost')
        .select('item_code,product_name,category,brand,qty,mrp,cost_per_unit')
        .gt('qty',0).lt('qty',4).order('qty').limit(10)
      setLowStock(inv||[])

      // Trend — fixed last-8-months context, independent of the period filter
      const now = new Date()
      const months: Record<string,{revenue:number,profit:number,qty:number}> = {}
      for (let i=7;i>=0;i--) { const d = subMonths(now,i); months[format(d,'MMM yy')] = {revenue:0,profit:0,qty:0} }
      const trendSales = await fetchAllRows('sales', 'date,net_amount,profit,qty', q => {
        let qq = q.gte('date', DATA_START)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })
      for (const r of trendSales) {
        const lbl = format(parseDate(r.date),'MMM yy')
        if (months[lbl]) { months[lbl].revenue+=r.net_amount||0; months[lbl].profit+=r.profit||0; months[lbl].qty+=r.qty||0 }
      }
      setTrendData(Object.entries(months).map(([label,v])=>({label,...v})))
    } finally { setLoading(false) }
  }, [dateRange.from, dateRange.to, selectedBranch])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Overview" subtitle="Dashboard" />
      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <DateNav grain={grain} onGrainChange={setGrain} offset={offset} onOffsetChange={setOffset} label={dateRange.label} />

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14 }}>
          <MetricCard label="Revenue" value={fmt_inr(metrics.revenue)} sub={dateRange.label} accent="purple" />
          <MetricCard label="Profit" value={fmt_inr(metrics.profit)} sub={`${metrics.margin.toFixed(1)}% margin`} accent="green" />
          <MetricCard label="Total Bills" value={fmt_num(metrics.bills)} accent="beige" />
          <MetricCard label="Units Sold" value={fmt_num(metrics.qty)} accent="beige" />
          <MetricCard label="Customers" value={fmt_num(metrics.customers)} sub="With phone" accent="beige" />
          <MetricCard label="Avg Bill" value={fmt_inr(metrics.bills?metrics.revenue/metrics.bills:0)} accent="beige" />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div style={S.card}>
            <h2 className="font-display" style={{ color: '#3b0764', fontSize: 16, margin: '0 0 16px' }}>Revenue Trend — Last 8 Months</h2>
            {loading?<div style={{ height:220,background:'#f5f0e8',borderRadius:12 }}/>:(
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top:4,right:8,left:0,bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7" />
                  <XAxis dataKey="label" tick={{ fontSize:10,fill:'#6b5b7b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10,fill:'#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar dataKey="profit" name="Profit" fill="#c4b5fd" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={S.card}>
            <h2 className="font-display" style={{ color: '#3b0764', fontSize: 16, margin: '0 0 16px' }}>Revenue by Category</h2>
            <p style={{ fontSize: 11, color: '#6b5b7b', margin: '-12px 0 12px' }}>{dateRange.label}</p>
            {loading?<div style={{ height:220,background:'#f5f0e8',borderRadius:12 }}/>:catData.length===0?(
              <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#6b5b7b', fontSize:13 }}>No sales this period</div>
            ):(
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,percent})=>`${name} ${((percent??0)*100).toFixed(0)}%`} labelLine={false} style={{ fontSize:9 }}>
                    {catData.map((_,i)=><Cell key={i} fill={PURPLE[i%PURPLE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v:any)=>fmt_inr(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={S.section}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8d5b7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <h3 className="font-display" style={{ color: '#3b0764', fontSize: 15, margin: 0 }}>Low Stock Alert</h3>
                <p style={{ fontSize: 11, color: '#6b5b7b', marginTop: 2 }}>Items with 3 or fewer units remaining · live, not period-scoped</p>
              </div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['Product','Category','Stock','MRP'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {lowStock.map((item,i)=>(
                  <tr key={item.item_code} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                    <td style={{ ...S.td, fontWeight:600 }}>{item.product_name?.slice(0,30)}</td>
                    <td style={{ ...S.td, color:'#6b5b7b' }}>{item.category}</td>
                    <td style={{ ...S.td, textAlign:'right' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontWeight:700, fontSize:11,
                        background:item.qty<=1?'#fee2e2':'#fef3c7', color:item.qty<=1?'#991b1b':'#92400e' }}>{item.qty}</span>
                    </td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:600 }}>{fmt_inr(item.mrp)}</td>
                  </tr>
                ))}
                {!loading&&lowStock.length===0&&(
                  <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', color:'#6b5b7b', padding:24 }}>✅ All items well stocked</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={S.section}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8d5b7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>👑</span>
              <div>
                <h3 className="font-display" style={{ color: '#3b0764', fontSize: 15, margin: 0 }}>Top Customers</h3>
                <p style={{ fontSize: 11, color: '#6b5b7b', marginTop: 2 }}>By spend · {dateRange.label}</p>
              </div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>
                {['Customer','Visits','Spend'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {topCustomers.map((c,i)=>(
                  <tr key={c.mobile_no||c.customer_name+i} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                    <td style={{ ...S.td, fontWeight:600 }}>
                      <Link href={`/customers?name=${encodeURIComponent(c.customer_name||'')}&mobile=${encodeURIComponent(c.mobile_no||'')}`}
                        style={{ color:'#3b0764', textDecoration:'underline', textDecorationColor:'#c4b5fd', textUnderlineOffset:2 }}>{c.customer_name}</Link>
                      <div style={{ fontSize:10, color:'#6b5b7b', fontFamily:'monospace' }}>{c.mobile_no}</div>
                    </td>
                    <td style={{ ...S.td, textAlign:'center' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontWeight:700, fontSize:11, background:'#ede9ff', color:'#3b0764' }}>{c.visit_count}×</span>
                    </td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#3b0764' }}>{fmt_inr(c.total_spend)}</td>
                  </tr>
                ))}
                {!loading&&topCustomers.length===0&&(
                  <tr><td colSpan={3} style={{ ...S.td, textAlign:'center', color:'#6b5b7b', padding:24 }}>No customers this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
