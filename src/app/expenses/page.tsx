'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_pct, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface MonthData { label: string; total: number }
interface CategoryRow { vendor: string; months: Record<string, number>; total: number }

const N_MONTHS = 6

function getMonths() {
  const now = new Date()
  return Array.from({ length: N_MONTHS }, (_, i) => {
    const d = subMonths(now, N_MONTHS - 1 - i)
    return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMM yy') }
  })
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [chartData, setChartData] = useState<MonthData[]>([])
  const [metrics, setMetrics] = useState({ total: 0, avg: 0, highest: '', peak: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const periods = getMonths()
      const lbls = periods.map(p => p.label)
      setMonths(lbls)

      const { data } = await supabase.from('expenses')
        .select('date,vendor_name,gross_total')
        .gte('date', periods[0].from)
        .lte('date', periods[periods.length - 1].to)

      if (!data) return

      const catMap: Record<string, CategoryRow> = {}
      const monthTotals: Record<string, number> = {}
      lbls.forEach(l => { monthTotals[l] = 0 })

      for (const row of data) {
        const vendor = row.vendor_name || 'Other'
        const lbl = format(new Date(row.date), 'MMM yy')
        const amt = row.gross_total || 0

        if (!catMap[vendor]) catMap[vendor] = { vendor, months: {}, total: 0 }
        catMap[vendor].months[lbl] = (catMap[vendor].months[lbl] || 0) + amt
        catMap[vendor].total += amt
        if (monthTotals[lbl] !== undefined) monthTotals[lbl] += amt
      }

      const sorted = Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 15)
      setRows(sorted)

      const chartPts = lbls.map(l => ({ label: l, total: monthTotals[l] || 0 }))
      setChartData(chartPts)

      const totalExp = Object.values(monthTotals).reduce((s, v) => s + v, 0)
      const peakMonth = chartPts.reduce((a, b) => b.total > a.total ? b : a, chartPts[0])
      setMetrics({ total: totalExp, avg: totalExp / N_MONTHS, highest: peakMonth?.label || '', peak: peakMonth?.total || 0 })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-sv-beige-dark rounded-xl shadow-gem px-4 py-3 text-xs">
        <p className="font-semibold text-sv-purple mb-1">{label}</p>
        <p className="text-sv-ink font-medium">{fmt_inr(payload[0]?.value)}</p>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <PageHeader title="Expenses" subtitle="Category breakdown and monthly trends" />
      <div className="px-8 pb-8 space-y-6">

        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="6-Month Total" value={fmt_inr(metrics.total)} sub="All expenses" accent="purple" />
          <MetricCard label="Monthly Avg" value={fmt_inr(metrics.avg)} sub="Per month" accent="beige" />
          <MetricCard label="Peak Month" value={metrics.highest} sub={fmt_inr(metrics.peak)} accent="amber" />
          <MetricCard label="Categories" value={`${rows.length}`} sub="Active vendors" accent="beige" />
        </div>

        {/* Monthly total chart */}
        <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card p-6">
          <h2 className="font-display text-sv-purple text-lg mb-5">Monthly Expense Trend</h2>
          {loading ? <div className="h-56 bg-sv-beige rounded-xl animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Expenses" fill="#7c3aed" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category × Month table */}
        <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-sv-beige-dark">
            <h2 className="font-display text-sv-purple text-lg">Expense Categories — Month on Month</h2>
            <p className="text-xs text-sv-muted mt-0.5">Top 15 vendors · last 6 months</p>
          </div>
          {loading ? <div className="h-48 animate-pulse bg-sv-beige m-4 rounded-xl" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-sv-purple text-white">
                    <th className="text-left px-5 py-3 font-semibold sticky left-0 bg-sv-purple min-w-[180px]">Vendor / Category</th>
                    {months.map(m => <th key={m} className="px-4 py-3 text-right font-semibold whitespace-nowrap border-l border-purple-700">{m}</th>)}
                    <th className="px-4 py-3 text-right font-semibold border-l border-purple-700 bg-purple-800">Total</th>
                    <th className="px-4 py-3 text-right font-semibold bg-purple-800">MoM%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const monthVals = months.map(m => row.months[m] || 0)
                    const lastTwo = monthVals.slice(-2)
                    const mom = lastTwo[0] > 0 ? ((lastTwo[1] - lastTwo[0]) / lastTwo[0] * 100) : 0

                    return (
                      <tr key={row.vendor} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', i%2===0?'':'bg-sv-beige/20')}>
                        <td className="px-5 py-2.5 font-medium text-sv-ink sticky left-0 bg-inherit max-w-[180px] truncate">{row.vendor}</td>
                        {months.map((m, mi) => {
                          const cur = row.months[m] || 0
                          const prv = mi > 0 ? (row.months[months[mi-1]] || 0) : 0
                          const chg = prv > 0 ? (cur - prv) / prv * 100 : 0
                          return (
                            <td key={m} className="px-4 py-2.5 text-right">
                              <div className="text-sv-ink font-medium">{cur > 0 ? fmt_inr(cur) : '—'}</div>
                              {mi > 0 && cur > 0 && prv > 0 && (
                                <div className={cn('text-[10px] font-medium', chg >= 0 ? 'text-red-500' : 'text-emerald-600')}>
                                  {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(0)}%
                                </div>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-2.5 text-right font-bold text-sv-ink">{fmt_inr(row.total)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-bold', mom >= 0 ? 'text-red-500' : 'text-emerald-600')}>
                          {mom !== 0 ? `${mom >= 0 ? '▲' : '▼'} ${Math.abs(mom).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals */}
                  <tr className="border-t-2 border-sv-purple bg-sv-purple-faint font-bold text-xs">
                    <td className="px-5 py-2.5 text-sv-purple sticky left-0 bg-sv-purple-faint">TOTAL</td>
                    {months.map(m => {
                      const tot = rows.reduce((s,r)=>s+(r.months[m]||0),0)
                      return <td key={m} className="px-4 py-2.5 text-right text-sv-ink">{fmt_inr(tot)}</td>
                    })}
                    <td className="px-4 py-2.5 text-right text-sv-ink">{fmt_inr(rows.reduce((s,r)=>s+r.total,0))}</td>
                    <td className="px-4 py-2.5 text-right" />
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
