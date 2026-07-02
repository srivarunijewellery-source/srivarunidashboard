'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, fmt_pct, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import GrainSelector from '@/components/ui/GrainSelector'
import MetricCard from '@/components/ui/MetricCard'
import type { Grain } from '@/lib/utils'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line, ComposedChart
} from 'recharts'
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

interface ChartPoint { label: string; revenue: number; profit: number; qty: number }
interface SalesmanRow {
  name: string
  months: Record<string, { sales: number; qty: number }>
  total_sales: number
  total_qty: number
}

const MONTHLY_RATE = 0.005
const HALF_RATE = 0.0025

function getPeriods(grain: Grain, n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const idx = n - 1 - i
    if (grain === 'day') {
      const d = subDays(now, idx)
      return { from: format(d, 'yyyy-MM-dd'), to: format(d, 'yyyy-MM-dd'), label: format(d, 'dd MMM') }
    }
    if (grain === 'week') {
      const start = startOfWeek(subWeeks(now, idx), { weekStartsOn: 1 })
      return { from: format(start, 'yyyy-MM-dd'), to: format(endOfWeek(start, { weekStartsOn: 1 }), 'yyyy-MM-dd'), label: format(start, 'dd MMM') }
    }
    if (grain === 'month') {
      const d = subMonths(now, idx)
      return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMM yy') }
    }
    const d = subMonths(now, idx * 3)
    const qs = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    const qe = new Date(qs.getFullYear(), qs.getMonth() + 3, 0)
    return { from: format(qs, 'yyyy-MM-dd'), to: format(qe, 'yyyy-MM-dd'), label: `Q${Math.floor(qs.getMonth()/3)+1} ${qs.getFullYear()}` }
  })
}

const N: Record<Grain, number> = { day: 14, week: 8, month: 12, quarter: 6 }

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-sv-beige-dark rounded-xl shadow-gem px-4 py-3 text-xs">
      <p className="font-semibold text-sv-purple mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }} className="font-bold">■</span>
          <span className="text-sv-muted">{p.name}:</span>
          <span className="font-semibold text-sv-ink">{p.name === 'Qty' ? fmt_num(p.value) : fmt_inr(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function SalesPage() {
  const [grain, setGrain] = useState<Grain>('month')
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [metrics, setMetrics] = useState({ revenue: 0, profit: 0, qty: 0, margin: 0 })
  const [loading, setLoading] = useState(false)
  const [salesmanRows, setSalesmanRows] = useState<SalesmanRow[]>([])
  const [commMonths, setCommMonths] = useState<string[]>([])
  const [commLoading, setCommLoading] = useState(false)

  const loadChart = useCallback(async () => {
    setLoading(true)
    try {
      const periods = getPeriods(grain, N[grain])
      const { data } = await supabase.from('sales').select('date,net_amount,profit,qty')
        .gte('date', periods[0].from).lte('date', periods[periods.length - 1].to)
      if (!data) return
      const buckets: Record<string, ChartPoint> = {}
      periods.forEach(p => { buckets[p.label] = { label: p.label, revenue: 0, profit: 0, qty: 0 } })
      for (const row of data) {
        const d = new Date(row.date)
        let lbl = ''
        if (grain === 'day') lbl = format(d, 'dd MMM')
        else if (grain === 'week') lbl = format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM')
        else if (grain === 'month') lbl = format(d, 'MMM yy')
        else lbl = `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`
        if (buckets[lbl]) { buckets[lbl].revenue += row.net_amount||0; buckets[lbl].profit += row.profit||0; buckets[lbl].qty += row.qty||0 }
      }
      const pts = periods.map(p => buckets[p.label])
      setChartData(pts)
      const totR = pts.reduce((s,p)=>s+p.revenue,0), totP = pts.reduce((s,p)=>s+p.profit,0), totQ = pts.reduce((s,p)=>s+p.qty,0)
      setMetrics({ revenue: totR, profit: totP, qty: totQ, margin: totR>0?totP/totR*100:0 })
    } finally { setLoading(false) }
  }, [grain])

  const loadCommissions = useCallback(async () => {
    setCommLoading(true)
    try {
      const periods = getPeriods('month', 6)
      const { data } = await supabase.from('sales').select('date,sales_man,net_amount,qty')
        .gte('date', periods[0].from).lte('date', periods[periods.length-1].to)
      if (!data) return
      const months = periods.map(p => p.label)
      setCommMonths(months)
      const map: Record<string, SalesmanRow> = {}
      for (const row of data) {
        const sm = row.sales_man || 'Unknown'
        const lbl = format(new Date(row.date), 'MMM yy')
        if (!map[sm]) map[sm] = { name: sm, months: {}, total_sales: 0, total_qty: 0 }
        if (!map[sm].months[lbl]) map[sm].months[lbl] = { sales: 0, qty: 0 }
        map[sm].months[lbl].sales += row.net_amount||0
        map[sm].months[lbl].qty += row.qty||0
        map[sm].total_sales += row.net_amount||0
        map[sm].total_qty += row.qty||0
      }
      setSalesmanRows(Object.values(map).sort((a,b)=>b.total_sales-a.total_sales))
    } finally { setCommLoading(false) }
  }, [])

  useEffect(() => { loadChart() }, [loadChart])
  useEffect(() => { loadCommissions() }, [loadCommissions])

  const last = chartData[chartData.length-1], prev = chartData[chartData.length-2]
  const delta = prev?.revenue > 0 ? ((last?.revenue||0) - prev.revenue) / prev.revenue * 100 : 0

  return (
    <div className="min-h-full">
      <PageHeader title="Sales" subtitle="Revenue, profitability and team performance" />
      <div className="px-8 pb-8 space-y-6">

        <div className="flex items-center justify-between">
          <GrainSelector value={grain} onChange={g => setGrain(g)} />
          <p className="text-xs text-sv-muted">Last {N[grain]} {grain}s</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Total Revenue" value={fmt_inr(metrics.revenue)} sub={`${N[grain]} ${grain}s`} accent="purple"
            delta={delta !== 0 ? { value: `${Math.abs(delta).toFixed(1)}% vs prev`, positive: delta >= 0 } : undefined} />
          <MetricCard label="Total Profit" value={fmt_inr(metrics.profit)} sub={`${fmt_pct(metrics.margin)} margin`} accent="green" />
          <MetricCard label="Units Sold" value={fmt_num(metrics.qty)} sub="Total items" accent="beige" />
          <MetricCard label={`Avg / ${grain}`} value={fmt_inr(chartData.length ? metrics.revenue / chartData.length : 0)} accent="beige" />
        </div>

        <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card p-6">
          <h2 className="font-display text-sv-purple text-lg mb-5">Revenue & Profit by {grain.charAt(0).toUpperCase()+grain.slice(1)}</h2>
          {loading ? <div className="h-72 bg-sv-beige rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar yAxisId="l" dataKey="revenue" name="Revenue" fill="#7c3aed" radius={[4,4,0,0]} />
                <Bar yAxisId="l" dataKey="profit"  name="Profit"  fill="#c4b5fd" radius={[4,4,0,0]} />
                <Line yAxisId="r" type="monotone" dataKey="qty" name="Qty" stroke="#f59e0b" strokeWidth={2} dot={{ r:3, fill:'#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Commission table */}
        <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-sv-beige-dark">
            <h2 className="font-display text-sv-purple text-lg">Sales Team — Commission Tracker</h2>
            <p className="text-xs text-sv-muted mt-0.5">Monthly 0.5% commission · 6-month bonus 0.25% of half-year total</p>
          </div>
          {commLoading ? <div className="h-48 animate-pulse bg-sv-beige m-4 rounded-xl" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sv-purple text-white">
                    <th className="text-left px-5 py-3 font-semibold sticky left-0 bg-sv-purple min-w-[150px]">Salesperson</th>
                    {commMonths.map(m => <th key={m} colSpan={3} className="px-2 py-3 text-center font-semibold whitespace-nowrap border-l border-purple-700">{m}</th>)}
                    <th colSpan={3} className="px-3 py-3 text-center font-semibold border-l border-purple-700 bg-purple-800 whitespace-nowrap">6M TOTAL</th>
                  </tr>
                  <tr className="bg-purple-900 text-purple-300 text-[10px]">
                    <th className="px-5 py-1.5 sticky left-0 bg-purple-900 text-left" />
                    {commMonths.map(m => (
                      <><th key={`${m}s`} className="px-2 py-1.5 text-right">Sales</th><th key={`${m}q`} className="px-2 py-1.5 text-right">Qty</th><th key={`${m}c`} className="px-2 py-1.5 text-right text-emerald-400">Comm</th></>
                    ))}
                    <th className="px-3 py-1.5 text-right">Sales</th><th className="px-3 py-1.5 text-right text-emerald-400">M.Comm</th><th className="px-3 py-1.5 text-right text-purple-300">6M Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {salesmanRows.map((sm, i) => (
                    <tr key={sm.name} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', i%2===0?'':'bg-sv-beige/20')}>
                      <td className="px-5 py-2.5 font-semibold text-sv-purple sticky left-0 bg-inherit">{sm.name}</td>
                      {commMonths.map(m => {
                        const d = sm.months[m]||{sales:0,qty:0}
                        return <><td key={`${m}s`} className="px-2 py-2.5 text-right text-sv-ink">{d.sales>0?fmt_inr(d.sales):'—'}</td><td key={`${m}q`} className="px-2 py-2.5 text-right text-sv-muted">{d.qty>0?d.qty:'—'}</td><td key={`${m}c`} className="px-2 py-2.5 text-right text-emerald-600 font-medium">{d.sales>0?fmt_inr(d.sales*MONTHLY_RATE):'—'}</td></>
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-sv-ink">{fmt_inr(sm.total_sales)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{fmt_inr(sm.total_sales*MONTHLY_RATE)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-sv-purple">{fmt_inr(sm.total_sales*HALF_RATE)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-sv-purple bg-sv-purple-faint font-bold text-xs">
                    <td className="px-5 py-2.5 text-sv-purple sticky left-0 bg-sv-purple-faint">TOTAL</td>
                    {commMonths.map(m => {
                      const s=salesmanRows.reduce((t,r)=>t+(r.months[m]?.sales||0),0), q=salesmanRows.reduce((t,r)=>t+(r.months[m]?.qty||0),0)
                      return <><td key={`t${m}s`} className="px-2 py-2.5 text-right text-sv-ink">{fmt_inr(s)}</td><td key={`t${m}q`} className="px-2 py-2.5 text-right text-sv-muted">{fmt_num(q)}</td><td key={`t${m}c`} className="px-2 py-2.5 text-right text-emerald-600">{fmt_inr(s*MONTHLY_RATE)}</td></>
                    })}
                    <td className="px-3 py-2.5 text-right text-sv-ink">{fmt_inr(salesmanRows.reduce((s,r)=>s+r.total_sales,0))}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{fmt_inr(salesmanRows.reduce((s,r)=>s+r.total_sales*MONTHLY_RATE,0))}</td>
                    <td className="px-3 py-2.5 text-right text-sv-purple">{fmt_inr(salesmanRows.reduce((s,r)=>s+r.total_sales*HALF_RATE,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
