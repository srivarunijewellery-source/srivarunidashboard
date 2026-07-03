'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchAllRows } from '@/lib/supabase'
import { fmt_inr, getAllMonths, getDateRange, parseDate, DATA_START, type Grain } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import DateNav from '@/components/ui/DateNav'
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
  const [grain, setGrain] = useState<Grain>('month')
  const [offset, setOffset] = useState(0)
  const dateRange = getDateRange(grain, offset)

  const [rows, setRows] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ total: 0, vendors: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Period-scoped vendor breakdown
      const data = await fetchAllRows('expenses', 'date,vendor_name,gross_total', q =>
        q.gte('date', dateRange.from).lte('date', dateRange.to))

      const catMap: Record<string, any> = {}
      for (const row of data) {
        const vendor = row.vendor_name || 'Other'
        const amt = row.gross_total || 0
        if (!catMap[vendor]) catMap[vendor] = { vendor, total: 0 }
        catMap[vendor].total += amt
      }
      const sorted = Object.values(catMap).sort((a:any,b:any)=>b.total-a.total).slice(0,15)
      setRows(sorted)
      setMetrics({ total: data.reduce((s,r)=>s+(r.gross_total||0),0), vendors: sorted.length })

      // Trend — fixed last-8-months context, independent of the period filter
      const now = new Date()
      const monthTotals: Record<string, number> = {}
      const months8: string[] = []
      for (let i=7;i>=0;i--) { const d = new Date(now.getFullYear(), now.getMonth()-i, 1); const lbl = format(d,'MMM yy'); months8.push(lbl); monthTotals[lbl]=0 }
      const trendData8 = await fetchAllRows('expenses', 'date,gross_total', q => q.gte('date', DATA_START))
      for (const r of trendData8) {
        const lbl = format(parseDate(r.date),'MMM yy')
        if (monthTotals[lbl]!==undefined) monthTotals[lbl]+=r.gross_total||0
      }
      setChartData(months8.map(l=>({ label:l, total: monthTotals[l]||0 })).filter(p=>p.total>0))
    } finally { setLoading(false) }
  }, [dateRange.from, dateRange.to])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Expenses" subtitle="Vendor breakdown and monthly trend" />
      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <DateNav grain={grain} onGrainChange={setGrain} offset={offset} onOffsetChange={setOffset} label={dateRange.label} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <MetricCard label="Expenses" value={fmt_inr(metrics.total)} sub={dateRange.label} accent="purple" />
          <MetricCard label="Vendors" value={`${metrics.vendors}`} sub="This period" accent="beige" />
          <MetricCard label="Avg per Vendor" value={fmt_inr(metrics.vendors?metrics.total/metrics.vendors:0)} accent="beige" />
        </div>

        <div style={{ ...S.section, padding: 24 }}>
          <h2 className="font-display" style={{ color: '#3b0764', fontSize: 18, margin: '0 0 20px' }}>Monthly Expense Trend — Last 8 Months</h2>
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

        <div style={S.section}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8d5b7' }}>
            <h2 className="font-display" style={{ color: '#3b0764', fontSize: 18, margin: 0 }}>Top Vendors — {dateRange.label}</h2>
            <p style={{ fontSize: 12, color: '#6b5b7b', marginTop: 4 }}>Top 15 vendors for the selected period</p>
          </div>
          {loading ? <div style={{ height: 200, background: '#f5f0e8', margin: 16, borderRadius: 12 }} /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#3b0764' }}>
                    <th style={{ ...S.th, background: '#3b0764', color: '#fff', textAlign: 'left' }}>Vendor</th>
                    <th style={{ ...S.th, background: '#3b0764', color: '#fff', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row:any, i) => (
                    <tr key={row.vendor} style={{ background: i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{row.vendor}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(row.total)}</td>
                    </tr>
                  ))}
                  {rows.length===0&&(
                    <tr><td colSpan={2} style={{ ...S.td, textAlign:'center', color:'#6b5b7b', padding:24 }}>No expenses this period</td></tr>
                  )}
                  <tr style={{ background: '#f5f0ff', borderTop: '2px solid #7c3aed' }}>
                    <td style={{ ...S.td, fontWeight: 700, color: '#3b0764' }}>TOTAL</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(metrics.total)}</td>
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
