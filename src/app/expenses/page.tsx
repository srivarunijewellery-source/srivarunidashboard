'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, getAllMonths, DATA_START } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const S = {
  section: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', overflow: 'hidden' },
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: 12, color: '#1a0a2e', borderBottom: '1px solid #f0e8d8' },
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e8d5b7', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(59,7,100,0.12)', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: '#3b0764', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#1a0a2e', fontWeight: 600 }}>{fmt_inr(payload[0]?.value)}</p>
    </div>
  )
}

export default function ExpensesPage() {
  const [rows, setRows] = useState<any[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ total: 0, avg: 0, highest: '', peak: 0, categories: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const periods = getAllMonths()
      const lbls = periods.map(p => p.label)
      setMonths(lbls)

      const { data } = await supabase.from('expenses').select('date,vendor_name,gross_total')
        .gte('date', DATA_START).lte('date', new Date().toISOString().split('T')[0])
      if (!data) return

      const catMap: Record<string, any> = {}
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

      const sorted = Object.values(catMap).sort((a,b)=>b.total-a.total).slice(0,15)
      setRows(sorted)

      const chartPts = lbls.map(l => ({ label: l, total: monthTotals[l]||0 })).filter(p=>p.total>0)
      setChartData(chartPts)

      const totalExp = Object.values(monthTotals).reduce((s,v)=>s+v,0)
      const activeMonths = Object.values(monthTotals).filter(v=>v>0).length
      const peakMonth = chartPts.reduce((a,b)=>b.total>a.total?b:a, chartPts[0]||{label:'',total:0})
      setMetrics({ total: totalExp, avg: activeMonths>0?totalExp/activeMonths:0, highest: peakMonth.label, peak: peakMonth.total, categories: sorted.length })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Expenses" subtitle="All time category breakdown and monthly trends" />
      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <MetricCard label="All-time Expenses" value={fmt_inr(metrics.total)} accent="purple" />
          <MetricCard label="Monthly Avg" value={fmt_inr(metrics.avg)} sub="Active months" accent="beige" />
          <MetricCard label="Peak Month" value={metrics.highest} sub={fmt_inr(metrics.peak)} accent="amber" />
          <MetricCard label="Vendors" value={`${metrics.categories}`} sub="Categories" accent="beige" />
        </div>

        {/* Chart */}
        <div style={{ ...S.section, padding: 24 }}>
          <h2 className="font-display" style={{ color: '#3b0764', fontSize: 18, margin: '0 0 20px' }}>Monthly Expense Trend</h2>
          {loading ? <div style={{ height: 220, background: '#f5f0e8', borderRadius: 12 }} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="total" name="Expenses" fill="#7c3aed" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* MoM table */}
        <div style={S.section}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8d5b7' }}>
            <h2 className="font-display" style={{ color: '#3b0764', fontSize: 18, margin: 0 }}>Expense Categories — Month on Month</h2>
            <p style={{ fontSize: 12, color: '#6b5b7b', marginTop: 4 }}>Top 15 vendors · all months · ▲ red = increase, ▼ green = decrease</p>
          </div>
          {loading ? <div style={{ height: 200, background: '#f5f0e8', margin: 16, borderRadius: 12 }} /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#3b0764' }}>
                    <th style={{ ...S.th, background: '#3b0764', color: '#fff', position: 'sticky', left: 0, minWidth: 180, textAlign: 'left' }}>Vendor / Category</th>
                    {months.map(m => <th key={m} style={{ ...S.th, background: '#3b0764', color: '#fff', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>{m}</th>)}
                    <th style={{ ...S.th, background: '#4c1d95', color: '#fff', textAlign: 'right' }}>Total</th>
                    <th style={{ ...S.th, background: '#4c1d95', color: '#fff', textAlign: 'right' }}>MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const vals = months.map(m => row.months[m]||0)
                    const lastTwo = vals.slice(-2)
                    const mom = lastTwo[0]>0 ? ((lastTwo[1]-lastTwo[0])/lastTwo[0]*100) : 0
                    return (
                      <tr key={row.vendor} style={{ background: i%2===0?'#fff':'#faf8ff' }}>
                        <td style={{ ...S.td, fontWeight: 600, position: 'sticky', left: 0, background: i%2===0?'#fff':'#faf8ff', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.vendor}</td>
                        {months.map((m, mi) => {
                          const cur = row.months[m]||0, prv = mi>0?(row.months[months[mi-1]]||0):0
                          const chg = prv>0?(cur-prv)/prv*100:0
                          return (
                            <td key={m} style={{ ...S.td, textAlign: 'right' }}>
                              <div style={{ fontWeight: 500 }}>{cur>0?fmt_inr(cur):'—'}</div>
                              {mi>0&&cur>0&&prv>0&&<div style={{ fontSize: 10, fontWeight: 700, color: chg>=0?'#dc2626':'#059669' }}>{chg>=0?'▲':'▼'} {Math.abs(chg).toFixed(0)}%</div>}
                            </td>
                          )
                        })}
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(row.total)}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: mom>=0?'#dc2626':'#059669' }}>
                          {mom!==0?`${mom>=0?'▲':'▼'} ${Math.abs(mom).toFixed(1)}%`:'—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#f5f0ff', borderTop: '2px solid #7c3aed' }}>
                    <td style={{ ...S.td, fontWeight: 700, color: '#3b0764', position: 'sticky', left: 0, background: '#f5f0ff' }}>TOTAL</td>
                    {months.map(m => {
                      const tot = rows.reduce((s,r)=>s+(r.months[m]||0),0)
                      return <td key={m} style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{tot>0?fmt_inr(tot):'—'}</td>
                    })}
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(rows.reduce((s,r)=>s+r.total,0))}</td>
                    <td style={S.td} />
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
