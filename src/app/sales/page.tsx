'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, fmt_pct, getPeriods, getAllMonths, DATA_START, type Grain } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import GrainSelector from '@/components/ui/GrainSelector'
import MetricCard from '@/components/ui/MetricCard'
import { format, startOfWeek } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts'

const MONTHLY_RATE = 0.005, HALF_RATE = 0.0025

const S = {
  section: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', overflow: 'hidden' },
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: 12, color: '#1a0a2e', borderBottom: '1px solid #f0e8d8' },
}

const N: Record<Grain, number> = { day: 14, week: 8, month: 8, quarter: 6 }

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
  const [grain, setGrain] = useState<Grain>('month')
  const [chartData, setChartData] = useState<any[]>([])
  const [metrics, setMetrics] = useState({ revenue: 0, profit: 0, qty: 0 })
  const [loading, setLoading] = useState(false)
  const [smRows, setSmRows] = useState<any[]>([])
  const [commMonths, setCommMonths] = useState<string[]>([])
  const [commLoading, setCommLoading] = useState(false)

  const loadChart = useCallback(async () => {
    setLoading(true)
    try {
      // Use all available months for month/quarter view
      const periods = grain === 'month'
        ? getAllMonths()
        : getPeriods(grain, N[grain])

      const { data } = await supabase.from('sales').select('date,net_amount,profit,qty')
        .gte('date', DATA_START).lte('date', new Date().toISOString().split('T')[0]).limit(10000)
      if (!data) return

      const buckets: Record<string, any> = {}
      periods.forEach(p => { buckets[p.label] = { label: p.label, revenue: 0, profit: 0, qty: 0 } })

      for (const row of data) {
        const d = new Date(row.date)
        let lbl = ''
        if (grain === 'day') lbl = format(d, 'dd MMM')
        else if (grain === 'week') lbl = format(startOfWeek(d, { weekStartsOn: 1 }), 'dd MMM')
        else if (grain === 'month') lbl = format(d, 'MMM yy')
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
  }, [grain])

  const loadCommissions = useCallback(async () => {
    setCommLoading(true)
    try {
      const periods = getAllMonths()
      const { data } = await supabase.from('sales').select('date,sales_man,net_amount,qty')
        .gte('date', DATA_START).lte('date', new Date().toISOString().split('T')[0]).limit(10000)
      if (!data) return

      const lbls = periods.map(p => p.label)
      setCommMonths(lbls)
      const map: Record<string, any> = {}
      for (const row of data) {
        const sm = row.sales_man || 'Unknown'
        const lbl = format(new Date(row.date), 'MMM yy')
        if (!map[sm]) map[sm] = { name: sm, months: {}, total: 0, qty: 0 }
        if (!map[sm].months[lbl]) map[sm].months[lbl] = { sales: 0, qty: 0 }
        map[sm].months[lbl].sales += row.net_amount||0
        map[sm].months[lbl].qty += row.qty||0
        map[sm].total += row.net_amount||0
        map[sm].qty += row.qty||0
      }
      setSmRows(Object.values(map).sort((a,b)=>b.total-a.total))
    } finally { setCommLoading(false) }
  }, [])

  useEffect(() => { loadChart() }, [loadChart])
  useEffect(() => { loadCommissions() }, [loadCommissions])

  const last = chartData[chartData.length-1], prev = chartData[chartData.length-2]
  const delta = prev?.revenue > 0 ? ((last?.revenue||0)-prev.revenue)/prev.revenue*100 : 0
  const margin = metrics.revenue > 0 ? metrics.profit/metrics.revenue*100 : 0

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Sales" subtitle="Revenue, profitability and team performance" />
      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

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

        {/* Chart */}
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

        {/* Commission table */}
        <div style={S.section}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8d5b7' }}>
            <h2 className="font-display" style={{ color: '#3b0764', fontSize: 18, margin: 0 }}>Sales Team — Commission Tracker</h2>
            <p style={{ fontSize: 12, color: '#6b5b7b', marginTop: 4 }}>Monthly 0.5% · Half-year bonus 0.25% of half-year total</p>
          </div>
          {commLoading ? <div style={{ height: 200, background: '#f5f0e8', margin: 16, borderRadius: 12 }} /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#3b0764' }}>
                    <th style={{ ...S.th, background: '#3b0764', color: '#fff', position: 'sticky', left: 0, minWidth: 150, textAlign: 'left' }}>Salesperson</th>
                    {commMonths.map(m => (
                      <th key={m} colSpan={3} style={{ ...S.th, background: '#3b0764', color: '#fff', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>{m}</th>
                    ))}
                    <th colSpan={3} style={{ ...S.th, background: '#4c1d95', color: '#fff', textAlign: 'center' }}>TOTAL</th>
                  </tr>
                  <tr style={{ background: '#4c1d95' }}>
                    <th style={{ ...S.th, background: '#4c1d95', color: '#c4b5fd', position: 'sticky', left: 0 }} />
                    {commMonths.map(m => (
                      <><th key={`${m}s`} style={{ ...S.th, background: '#4c1d95', color: '#c4b5fd', textAlign: 'right', fontSize: 10 }}>Sales</th>
                      <th key={`${m}q`} style={{ ...S.th, background: '#4c1d95', color: '#c4b5fd', textAlign: 'right', fontSize: 10 }}>Qty</th>
                      <th key={`${m}c`} style={{ ...S.th, background: '#4c1d95', color: '#86efac', textAlign: 'right', fontSize: 10 }}>Comm</th></>
                    ))}
                    <th style={{ ...S.th, background: '#4c1d95', color: '#c4b5fd', textAlign: 'right', fontSize: 10 }}>Sales</th>
                    <th style={{ ...S.th, background: '#4c1d95', color: '#86efac', textAlign: 'right', fontSize: 10 }}>M.Comm</th>
                    <th style={{ ...S.th, background: '#4c1d95', color: '#a78bfa', textAlign: 'right', fontSize: 10 }}>6M Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {smRows.map((sm, i) => (
                    <tr key={sm.name} style={{ background: i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight: 700, color: '#3b0764', position: 'sticky', left: 0, background: i%2===0?'#fff':'#faf8ff' }}>{sm.name}</td>
                      {commMonths.map(m => {
                        const d = sm.months[m]||{sales:0,qty:0}
                        return (
                          <><td key={`${m}s`} style={{ ...S.td, textAlign: 'right' }}>{d.sales>0?fmt_inr(d.sales):'—'}</td>
                          <td key={`${m}q`} style={{ ...S.td, textAlign: 'right', color: '#6b5b7b' }}>{d.qty>0?d.qty:'—'}</td>
                          <td key={`${m}c`} style={{ ...S.td, textAlign: 'right', color: '#059669', fontWeight: 600 }}>{d.sales>0?fmt_inr(d.sales*MONTHLY_RATE):'—'}</td></>
                        )
                      })}
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(sm.total)}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt_inr(sm.total*MONTHLY_RATE)}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{fmt_inr(sm.total*HALF_RATE)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f5f0ff', borderTop: '2px solid #7c3aed' }}>
                    <td style={{ ...S.td, fontWeight: 700, color: '#3b0764', position: 'sticky', left: 0, background: '#f5f0ff' }}>TOTAL</td>
                    {commMonths.map(m => {
                      const s=smRows.reduce((t,r)=>t+(r.months[m]?.sales||0),0), q=smRows.reduce((t,r)=>t+(r.months[m]?.qty||0),0)
                      return (
                        <><td key={`t${m}s`} style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(s)}</td>
                        <td key={`t${m}q`} style={{ ...S.td, textAlign: 'right', color: '#6b5b7b', fontWeight: 700 }}>{fmt_num(q)}</td>
                        <td key={`t${m}c`} style={{ ...S.td, textAlign: 'right', color: '#059669', fontWeight: 700 }}>{fmt_inr(s*MONTHLY_RATE)}</td></>
                      )
                    })}
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt_inr(smRows.reduce((s,r)=>s+r.total,0))}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt_inr(smRows.reduce((s,r)=>s+r.total*MONTHLY_RATE,0))}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{fmt_inr(smRows.reduce((s,r)=>s+r.total*HALF_RATE,0))}</td>
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
