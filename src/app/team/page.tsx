'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MONTHLY_RATE = 0.005
const HALF_RATE    = 0.0025
const N_MONTHS     = 6

interface SalesmanRow {
  name: string
  months: Record<string, { sales: number; qty: number }>
  total_sales: number
  total_qty: number
  monthly_comm: number
  half_bonus: number
}

function getMonths() {
  const now = new Date()
  return Array.from({ length: N_MONTHS }, (_, i) => {
    const d = subMonths(now, N_MONTHS - 1 - i)
    return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMM yy') }
  })
}

const COLORS = ['#3b0764','#6d28d9','#7c3aed','#a78bfa','#c4b5fd','#ede9ff']

export default function TeamPage() {
  const [rows, setRows] = useState<SalesmanRow[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [chartType, setChartType] = useState<'sales' | 'comm'>('sales')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const periods = getMonths()
      setMonths(periods.map(p => p.label))
      const { data } = await supabase.from('sales')
        .select('date,sales_man,net_amount,qty')
        .gte('date', periods[0].from)
        .lte('date', periods[periods.length-1].to)
      if (!data) return

      const map: Record<string, SalesmanRow> = {}
      for (const row of data) {
        const sm = row.sales_man || 'Unknown'
        const lbl = format(new Date(row.date), 'MMM yy')
        if (!map[sm]) map[sm] = { name: sm, months: {}, total_sales: 0, total_qty: 0, monthly_comm: 0, half_bonus: 0 }
        if (!map[sm].months[lbl]) map[sm].months[lbl] = { sales: 0, qty: 0 }
        map[sm].months[lbl].sales += row.net_amount||0
        map[sm].months[lbl].qty   += row.qty||0
        map[sm].total_sales += row.net_amount||0
        map[sm].total_qty   += row.qty||0
      }
      for (const sm of Object.values(map)) {
        sm.monthly_comm = sm.total_sales * MONTHLY_RATE
        sm.half_bonus   = sm.total_sales * HALF_RATE
      }
      setRows(Object.values(map).sort((a,b)=>b.total_sales-a.total_sales))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const chartData = rows.map(r => ({
    name: r.name,
    sales: r.total_sales,
    commission: r.monthly_comm + r.half_bonus,
  }))

  const totalSales = rows.reduce((s,r)=>s+r.total_sales,0)
  const totalComm  = rows.reduce((s,r)=>s+r.monthly_comm+r.half_bonus,0)
  const topSm = rows[0]

  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-sv-beige-dark rounded-xl shadow-gem px-4 py-3 text-xs">
        <p className="font-semibold text-sv-purple mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex justify-between gap-4 mt-0.5">
            <span className="text-sv-muted">{p.name}:</span>
            <span className="font-semibold text-sv-ink">{fmt_inr(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <PageHeader title="Sales Team" subtitle="6-month performance and commission breakdown" />
      <div className="px-8 pb-8 space-y-6">

        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Team Revenue" value={fmt_inr(totalSales)} sub="Last 6 months" accent="purple" />
          <MetricCard label="Total Commission" value={fmt_inr(totalComm)} sub="Monthly + half-year bonus" accent="green" />
          <MetricCard label="Team Members" value={`${rows.length}`} sub="Active salespeople" accent="beige" />
          <MetricCard label="Top Performer" value={topSm?.name || '—'} sub={topSm ? fmt_inr(topSm.total_sales) : ''} accent="beige" />
        </div>

        {/* Chart */}
        <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-sv-purple text-lg">Team Performance</h2>
            <div className="flex gap-2">
              {(['sales','comm'] as const).map(t => (
                <button key={t} onClick={() => setChartType(t)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    chartType===t ? 'bg-sv-purple text-white border-sv-purple' : 'border-sv-beige-dark text-sv-muted hover:border-sv-purple')}>
                  {t === 'sales' ? 'Revenue' : 'Commission'}
                </button>
              ))}
            </div>
          </div>
          {loading ? <div className="h-56 bg-sv-beige rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<Tip />} />
                <Bar dataKey={chartType === 'sales' ? 'sales' : 'commission'} name={chartType === 'sales' ? 'Revenue' : 'Commission'} radius={[6,6,0,0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Detailed commission table */}
        <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-sv-beige-dark">
            <h2 className="font-display text-sv-purple text-lg">Commission Breakdown — Last 6 Months</h2>
            <p className="text-xs text-sv-muted mt-0.5">Monthly 0.5% · Half-year bonus 0.25% of 6-month total</p>
          </div>
          {loading ? <div className="h-48 animate-pulse bg-sv-beige m-4 rounded-xl" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sv-purple text-white">
                    <th className="text-left px-5 py-3 font-semibold sticky left-0 bg-sv-purple min-w-[150px]">Salesperson</th>
                    {months.map(m => (
                      <th key={m} colSpan={3} className="px-2 py-3 text-center font-semibold border-l border-purple-700 whitespace-nowrap">{m}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-semibold border-l border-purple-700 bg-purple-800 whitespace-nowrap" colSpan={4}>6M TOTALS</th>
                  </tr>
                  <tr className="bg-purple-900 text-purple-300 text-[10px]">
                    <th className="px-5 py-1.5 sticky left-0 bg-purple-900 text-left" />
                    {months.map(m => (
                      <><th key={`${m}s`} className="px-2 py-1.5 text-right">Sales</th><th key={`${m}q`} className="px-2 py-1.5 text-right">Qty</th><th key={`${m}c`} className="px-2 py-1.5 text-right text-emerald-400">Comm</th></>
                    ))}
                    <th className="px-3 py-1.5 text-right">Sales</th>
                    <th className="px-3 py-1.5 text-right">Qty</th>
                    <th className="px-3 py-1.5 text-right text-emerald-400">M.Comm</th>
                    <th className="px-3 py-1.5 text-right text-purple-300">6M Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sm, i) => (
                    <tr key={sm.name} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', i%2===0?'':'bg-sv-beige/20')}>
                      <td className="px-5 py-2.5 font-semibold text-sv-purple sticky left-0 bg-inherit">{sm.name}</td>
                      {months.map(m => {
                        const d = sm.months[m]||{sales:0,qty:0}
                        return (
                          <><td key={`${m}s`} className="px-2 py-2.5 text-right text-sv-ink">{d.sales>0?fmt_inr(d.sales):'—'}</td>
                          <td key={`${m}q`} className="px-2 py-2.5 text-right text-sv-muted">{d.qty>0?d.qty:'—'}</td>
                          <td key={`${m}c`} className="px-2 py-2.5 text-right text-emerald-600 font-medium">{d.sales>0?fmt_inr(d.sales*MONTHLY_RATE):'—'}</td></>
                        )
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-sv-ink">{fmt_inr(sm.total_sales)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-sv-muted">{fmt_num(sm.total_qty)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{fmt_inr(sm.monthly_comm)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-sv-purple">{fmt_inr(sm.half_bonus)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-sv-purple bg-sv-purple-faint font-bold">
                    <td className="px-5 py-2.5 text-sv-purple sticky left-0 bg-sv-purple-faint">TOTAL</td>
                    {months.map(m => {
                      const s=rows.reduce((t,r)=>t+(r.months[m]?.sales||0),0)
                      const q=rows.reduce((t,r)=>t+(r.months[m]?.qty||0),0)
                      return <><td key={`t${m}s`} className="px-2 py-2.5 text-right text-sv-ink">{fmt_inr(s)}</td><td key={`t${m}q`} className="px-2 py-2.5 text-right text-sv-muted">{fmt_num(q)}</td><td key={`t${m}c`} className="px-2 py-2.5 text-right text-emerald-600">{fmt_inr(s*MONTHLY_RATE)}</td></>
                    })}
                    <td className="px-3 py-2.5 text-right text-sv-ink">{fmt_inr(totalSales)}</td>
                    <td className="px-3 py-2.5 text-right text-sv-muted">{fmt_num(rows.reduce((s,r)=>s+r.total_qty,0))}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{fmt_inr(rows.reduce((s,r)=>s+r.monthly_comm,0))}</td>
                    <td className="px-3 py-2.5 text-right text-sv-purple">{fmt_inr(rows.reduce((s,r)=>s+r.half_bonus,0))}</td>
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
