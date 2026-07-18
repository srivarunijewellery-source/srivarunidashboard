'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchAllRows } from '@/lib/supabase'
import { useBranch } from '@/lib/branch-context'
import { fmt_inr, fmt_num, getDateRange } from '@/lib/utils'
import { useDateRange } from '@/lib/date-range-context'
import { useSortable } from '@/lib/useSortable'
import SortIndicator from '@/components/ui/SortIndicator'
import PageHeader from '@/components/layout/PageHeader'
import DateNav from '@/components/ui/DateNav'
import MetricCard from '@/components/ui/MetricCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// sales_unified = FTP-sourced sales for every date it covers, backfilled with
// API-sourced sales_api for anything after FTP's last successful sync.
//
// IMPORTANT: sales_man is NULL on every API-sourced row -- the Sales
// Reporting API doesn't return it (VasyERP hasn't shared that field yet).
// So this page splits sales into "attributed" (has a sales_man -- always
// true for FTP rows, and will be true for API rows too once VasyERP adds
// the field) and "unattributed". Commission is calculated ONLY on
// attributed rows, so nobody gets paid commission on a bucket nobody can
// verify. Team Revenue still reports the true total (attributed +
// unattributed) so the number itself isn't understated -- the unattributed
// slice is shown separately instead of hidden.
//
// TODO: once VasyERP's API includes sales_man, this attributed/unattributed
// split becomes unnecessary -- every row will be attributed and this file
// simplifies back to the pre-split version.
const SALES_SOURCE = 'sales_unified'

const MONTHLY_RATE = 0.005, HALF_RATE = 0.0025
const COLORS = ['#3b0764','#6d28d9','#7c3aed','#a78bfa','#c4b5fd','#ede9ff']
const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'10px 12px', fontSize:11, fontWeight:600, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'10px 10px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8' },
}

export default function TeamPage() {
  const { selectedBranch } = useBranch()
  const { grain, offset, setGrain, setOffset } = useDateRange()
  const dateRange = getDateRange(grain, offset)

  const [rows, setRows] = useState<any[]>([])
  const [unattributedRevenue, setUnattributedRevenue] = useState(0)
  const [loading, setLoading] = useState(false)
  const [chartType, setChartType] = useState<'sales'|'comm'>('sales')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllRows(SALES_SOURCE, 'sales_man,net_amount,qty', q => {
        let qq = q.gte('date',dateRange.from).lte('date',dateRange.to)
        if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
        return qq
      })

      const attributed = data.filter(r => r.sales_man)
      const unattributed = data.filter(r => !r.sales_man)

      const map: Record<string,any> = {}
      for (const row of attributed) {
        const sm = row.sales_man
        if (!map[sm]) map[sm] = {name:sm,total:0,qty:0}
        map[sm].total += row.net_amount||0
        map[sm].qty += row.qty||0
      }
      setRows(Object.values(map).sort((a,b)=>b.total-a.total))
      setUnattributedRevenue(unattributed.reduce((s,r)=>s+(r.net_amount||0),0))
    } finally { setLoading(false) }
  }, [dateRange.from, dateRange.to, selectedBranch])

  useEffect(() => { load() }, [load])

  // "Team Revenue" reports the TRUE total (attributed + unattributed) so the
  // headline number isn't understated. Commission is calculated only from
  // `rows` (attributed), further down -- that math is unchanged from before.
  const attributedSales = rows.reduce((s,r)=>s+r.total,0)
  const totalSales = attributedSales + unattributedRevenue
  const totalComm  = rows.reduce((s,r)=>s+r.total*(MONTHLY_RATE+HALF_RATE),0)
  const chartData  = rows.map(r=>({ name:r.name, sales:r.total, commission:r.total*(MONTHLY_RATE+HALF_RATE) }))

  const rowsGetValue = useCallback((r:any, key:string) => {
    if (key==='commission') return r.total*(MONTHLY_RATE+HALF_RATE)
    return r[key]
  }, [])
  const { sorted: sortedRows, sortKey: rowsSortKey, sortDir: rowsSortDir, toggleSort: toggleRowsSort } = useSortable(rows, rowsGetValue)

  const Tip = ({ active, payload, label }: any) => {
    if (!active||!payload?.length) return null
    return (
      <div style={{ background:'#fff', border:'1px solid #e8d5b7', borderRadius:12, padding:'10px 14px', fontSize:12 }}>
        <p style={{ fontWeight:700, color:'#3b0764', marginBottom:4 }}>{label}</p>
        {payload.map((p:any)=>(<div key={p.dataKey} style={{ display:'flex', justifyContent:'space-between', gap:12 }}><span style={{ color:'#6b5b7b' }}>{p.name}:</span><span style={{ fontWeight:600 }}>{fmt_inr(p.value)}</span></div>))}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Sales Team" subtitle="Performance and commission breakdown" />
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:20 }}>

        <DateNav grain={grain} onGrainChange={setGrain} offset={offset} onOffsetChange={setOffset} label={dateRange.label} />

        {unattributedRevenue > 0 && (
          <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:12, padding:'12px 16px', fontSize:12.5, color:'#92400e' }}>
            <strong>{fmt_inr(unattributedRevenue)}</strong> in this period has no salesperson on record (recent sales pulled via the VasyERP Sales Reporting API, which doesn't include sales_man yet) — included in Team Revenue below, but excluded from every commission calculation. Once VasyERP adds salesperson to the API, this will resolve automatically.
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          <MetricCard label="Team Revenue" value={fmt_inr(totalSales)} sub={dateRange.label} accent="purple"/>
          <MetricCard label="Total Commission" value={fmt_inr(totalComm)} sub="Monthly 0.5% + 0.25% bonus" accent="green"/>
          <MetricCard label="Team Members" value={`${rows.length}`} accent="beige"/>
          <MetricCard label="Top Performer" value={rows[0]?.name||'—'} sub={rows[0]?fmt_inr(rows[0].total):''} accent="beige"/>
        </div>

        <div style={{ ...S.section, padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:18, margin:0 }}>Team Performance — {dateRange.label}</h2>
            <div style={{ display:'flex', gap:8 }}>
              {(['sales','comm'] as const).map(t=>(
                <button key={t} onClick={()=>setChartType(t)} style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:`1px solid ${chartType===t?'#3b0764':'#e8d5b7'}`, background:chartType===t?'#3b0764':'#fff', color:chartType===t?'#fff':'#6b5b7b' }}>{t==='sales'?'Revenue':'Commission'}</button>
              ))}
            </div>
          </div>
          {loading?<div style={{ height:240, background:'#f5f0e8', borderRadius:12 }}/>:(
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top:4,right:12,left:0,bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7"/>
                <XAxis dataKey="name" tick={{ fontSize:11,fill:'#6b5b7b' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11,fill:'#6b5b7b' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey={chartType==='sales'?'sales':'commission'} name={chartType==='sales'?'Revenue':'Commission'} radius={[6,6,0,0]}>
                  {chartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={S.section}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7' }}>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:17, margin:0 }}>Commission Detail — {dateRange.label}</h2>
            <p style={{ fontSize:11, color:'#6b5b7b', marginTop:4 }}>0.5% monthly rate + 0.25% bonus rate applied to this period's total · attributed sales only</p>
          </div>
          {loading?<div style={{ height:200, background:'#f5f0e8', margin:16, borderRadius:12 }}/>:(
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#3b0764' }}>
                    <th onClick={()=>toggleRowsSort('name')} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'left', cursor:'pointer' }}>Salesperson<SortIndicator active={rowsSortKey==='name'} dir={rowsSortDir}/></th>
                    <th onClick={()=>toggleRowsSort('total')} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'right', cursor:'pointer' }}>Revenue<SortIndicator active={rowsSortKey==='total'} dir={rowsSortDir}/></th>
                    <th onClick={()=>toggleRowsSort('qty')} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'right', cursor:'pointer' }}>Qty<SortIndicator active={rowsSortKey==='qty'} dir={rowsSortDir}/></th>
                    <th style={{ ...S.th, background:'#3b0764', color:'#86efac', textAlign:'right' }}>Monthly (0.5%)</th>
                    <th style={{ ...S.th, background:'#3b0764', color:'#a78bfa', textAlign:'right' }}>Bonus (0.25%)</th>
                    <th onClick={()=>toggleRowsSort('commission')} style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'right', cursor:'pointer' }}>Total Comm.<SortIndicator active={rowsSortKey==='commission'} dir={rowsSortDir}/></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((sm,i)=>(
                    <tr key={sm.name} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>{sm.name}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_inr(sm.total)}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{fmt_num(sm.qty)}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#059669', fontWeight:600 }}>{fmt_inr(sm.total*MONTHLY_RATE)}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#7c3aed', fontWeight:600 }}>{fmt_inr(sm.total*HALF_RATE)}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(sm.total*(MONTHLY_RATE+HALF_RATE))}</td>
                    </tr>
                  ))}
                  {rows.length===0&&(
                    <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'#6b5b7b', padding:24 }}>No sales this period</td></tr>
                  )}
                  <tr style={{ background:'#f5f0ff', borderTop:'2px solid #7c3aed' }}>
                    <td style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>TOTAL</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_inr(attributedSales)}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#6b5b7b' }}>{fmt_num(rows.reduce((s,r)=>s+r.qty,0))}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(rows.reduce((s,r)=>s+r.total*MONTHLY_RATE,0))}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#7c3aed' }}>{fmt_inr(rows.reduce((s,r)=>s+r.total*HALF_RATE,0))}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(totalComm)}</td>
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
