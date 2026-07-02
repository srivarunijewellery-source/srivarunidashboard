'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, getAllMonths, DATA_START } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MONTHLY_RATE = 0.005, HALF_RATE = 0.0025
const COLORS = ['#3b0764','#6d28d9','#7c3aed','#a78bfa','#c4b5fd','#ede9ff']
const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'10px 12px', fontSize:11, fontWeight:600, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'10px 10px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8' },
}

// Build half-year options from data
function getHalfOptions() {
  const now = new Date()
  const options = []
  for (let y = 2025; y <= now.getFullYear(); y++) {
    options.push({ label: `H1 ${y} (Jan–Jun)`, from: `${y}-01-01`, to: `${y}-06-30` })
    options.push({ label: `H2 ${y} (Jul–Dec)`, from: `${y}-07-01`, to: `${y}-12-31` })
  }
  return options.filter(o => o.from <= format(now,'yyyy-MM-dd')).reverse()
}

export default function TeamPage() {
  const [rows, setRows] = useState<any[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [chartType, setChartType] = useState<'sales'|'comm'>('sales')

  // Filters
  const [filterMode, setFilterMode] = useState<'all'|'half'|'custom'>('all')
  const halfOptions = getHalfOptions()
  const [selHalf, setSelHalf] = useState(halfOptions[0]?.label||'')
  const [customFrom, setCustomFrom] = useState(DATA_START)
  const [customTo, setCustomTo] = useState(format(new Date(),'yyyy-MM-dd'))

  const getRange = useCallback(():{from:string,to:string} => {
    if (filterMode==='half') {
      const h = halfOptions.find(o=>o.label===selHalf)
      return h ? {from:h.from,to:h.to} : {from:DATA_START,to:format(new Date(),'yyyy-MM-dd')}
    }
    if (filterMode==='custom') return {from:customFrom,to:customTo}
    return {from:DATA_START,to:format(new Date(),'yyyy-MM-dd')}
  }, [filterMode,selHalf,customFrom,customTo,halfOptions])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const {from,to} = getRange()
      const { data } = await supabase.from('sales').select('date,sales_man,net_amount,qty')
        .gte('date',from).lte('date',to).limit(10000)
      if (!data) return

      // Build month columns from the filtered range
      const seenMonths = new Set<string>()
      const map: Record<string,any> = {}
      for (const row of data) {
        const sm = row.sales_man||'Unknown'
        const lbl = format(new Date(row.date),'MMM yy')
        seenMonths.add(lbl)
        if (!map[sm]) map[sm] = {name:sm,months:{},total:0,qty:0}
        if (!map[sm].months[lbl]) map[sm].months[lbl] = {sales:0,qty:0}
        map[sm].months[lbl].sales += row.net_amount||0
        map[sm].months[lbl].qty += row.qty||0
        map[sm].total += row.net_amount||0
        map[sm].qty += row.qty||0
      }

      // Sort months chronologically
      const sortedMonths = [...seenMonths].sort((a,b)=>new Date('01 '+a).getTime()-new Date('01 '+b).getTime())
      setMonths(sortedMonths)
      setRows(Object.values(map).sort((a,b)=>b.total-a.total))
    } finally { setLoading(false) }
  }, [getRange])

  useEffect(() => { load() }, [load])

  const totalSales = rows.reduce((s,r)=>s+r.total,0)
  const totalComm  = rows.reduce((s,r)=>s+r.total*(MONTHLY_RATE+HALF_RATE),0)
  const chartData  = rows.map(r=>({ name:r.name, sales:r.total, commission:r.total*(MONTHLY_RATE+HALF_RATE) }))
  const {from,to}  = getRange()

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

        {/* Filters */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8d5b7', padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#3b0764' }}>Period:</span>
          {(['all','half','custom'] as const).map(m=>(
            <button key={m} onClick={()=>setFilterMode(m)} style={{
              padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer',
              border:`1px solid ${filterMode===m?'#3b0764':'#e8d5b7'}`,
              background:filterMode===m?'#3b0764':'#fff', color:filterMode===m?'#fff':'#6b5b7b'
            }}>{m==='all'?'All Time':m==='half'?'Half Year':'Custom'}</button>
          ))}
          {filterMode==='half'&&(
            <select value={selHalf} onChange={e=>setSelHalf(e.target.value)} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:12, color:'#1a0a2e', background:'#fff' }}>
              {halfOptions.map(o=><option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
          )}
          {filterMode==='custom'&&(
            <>
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:12, color:'#1a0a2e' }}/>
              <span style={{ color:'#6b5b7b', fontSize:12 }}>to</span>
              <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:12, color:'#1a0a2e' }}/>
            </>
          )}
          <span style={{ fontSize:11, color:'#6b5b7b', marginLeft:'auto' }}>{from} → {to}</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
          <MetricCard label="Team Revenue" value={fmt_inr(totalSales)} accent="purple"/>
          <MetricCard label="Total Commission" value={fmt_inr(totalComm)} sub="Monthly + bonus" accent="green"/>
          <MetricCard label="Team Members" value={`${rows.length}`} accent="beige"/>
          <MetricCard label="Top Performer" value={rows[0]?.name||'—'} sub={rows[0]?fmt_inr(rows[0].total):''} accent="beige"/>
        </div>

        {/* Chart */}
        <div style={{ ...S.section, padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:18, margin:0 }}>Team Performance</h2>
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

        {/* Commission table */}
        <div style={S.section}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7' }}>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:17, margin:0 }}>Commission Detail</h2>
            <p style={{ fontSize:11, color:'#6b5b7b', marginTop:4 }}>Monthly 0.5% on each month's sales · 6-month bonus 0.25% on period total</p>
          </div>
          {loading?<div style={{ height:200, background:'#f5f0e8', margin:16, borderRadius:12 }}/>:(
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#3b0764' }}>
                    <th style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, minWidth:140, textAlign:'left' }}>Salesperson</th>
                    {months.map(m=><th key={m} colSpan={3} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'center', borderLeft:'1px solid rgba(255,255,255,0.1)' }}>{m}</th>)}
                    <th colSpan={4} style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'center' }}>TOTALS</th>
                  </tr>
                  <tr style={{ background:'#4c1d95' }}>
                    <th style={{ ...S.th, background:'#4c1d95', color:'#c4b5fd', position:'sticky', left:0 }}/>
                    {months.map(m=>(
                      <><th key={`${m}s`} style={{ ...S.th, background:'#4c1d95', color:'#c4b5fd', textAlign:'right', fontSize:10 }}>Sales</th>
                      <th key={`${m}q`} style={{ ...S.th, background:'#4c1d95', color:'#c4b5fd', textAlign:'right', fontSize:10 }}>Qty</th>
                      <th key={`${m}c`} style={{ ...S.th, background:'#4c1d95', color:'#86efac', textAlign:'right', fontSize:10 }}>Comm</th></>
                    ))}
                    <th style={{ ...S.th, background:'#4c1d95', color:'#c4b5fd', textAlign:'right', fontSize:10 }}>Revenue</th>
                    <th style={{ ...S.th, background:'#4c1d95', color:'#c4b5fd', textAlign:'right', fontSize:10 }}>Qty</th>
                    <th style={{ ...S.th, background:'#4c1d95', color:'#86efac', textAlign:'right', fontSize:10 }}>M.Comm</th>
                    <th style={{ ...S.th, background:'#4c1d95', color:'#a78bfa', textAlign:'right', fontSize:10 }}>Period Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sm,i)=>(
                    <tr key={sm.name} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight:700, color:'#3b0764', position:'sticky', left:0, background:i%2===0?'#fff':'#faf8ff' }}>{sm.name}</td>
                      {months.map(m=>{
                        const d=sm.months[m]||{sales:0,qty:0}
                        return (<><td key={`${m}s`} style={{ ...S.td, textAlign:'right' }}>{d.sales>0?fmt_inr(d.sales):'—'}</td><td key={`${m}q`} style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{d.qty>0?d.qty:'—'}</td><td key={`${m}c`} style={{ ...S.td, textAlign:'right', color:'#059669', fontWeight:600 }}>{d.sales>0?fmt_inr(d.sales*MONTHLY_RATE):'—'}</td></>)
                      })}
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_inr(sm.total)}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#6b5b7b' }}>{fmt_num(sm.qty)}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(sm.total*MONTHLY_RATE)}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#7c3aed' }}>{fmt_inr(sm.total*HALF_RATE)}</td>
                    </tr>
                  ))}
                  <tr style={{ background:'#f5f0ff', borderTop:'2px solid #7c3aed' }}>
                    <td style={{ ...S.td, fontWeight:700, color:'#3b0764', position:'sticky', left:0, background:'#f5f0ff' }}>TOTAL</td>
                    {months.map(m=>{
                      const s=rows.reduce((t,r)=>t+(r.months[m]?.sales||0),0), q=rows.reduce((t,r)=>t+(r.months[m]?.qty||0),0)
                      return (<><td key={`t${m}s`} style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{s>0?fmt_inr(s):'—'}</td><td key={`t${m}q`} style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#6b5b7b' }}>{q>0?fmt_num(q):'—'}</td><td key={`t${m}c`} style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{s>0?fmt_inr(s*MONTHLY_RATE):'—'}</td></>)
                    })}
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_inr(totalSales)}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#6b5b7b' }}>{fmt_num(rows.reduce((s,r)=>s+r.qty,0))}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(rows.reduce((s,r)=>s+r.total*MONTHLY_RATE,0))}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#7c3aed' }}>{fmt_inr(rows.reduce((s,r)=>s+r.total*HALF_RATE,0))}</td>
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
