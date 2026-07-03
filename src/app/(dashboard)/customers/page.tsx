'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { fmt_inr, fmt_num, fmt_pct, DATA_START, parseDate, getDateRange, vasyErpProductUrl, type Grain } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import DateNav from '@/components/ui/DateNav'
import OrderModal from '@/components/ui/OrderModal'
import { useBranch } from '@/lib/branch-context'
import { useDateRange } from '@/lib/date-range-context'
import { Search } from 'lucide-react'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'10px 14px', fontSize:11, fontWeight:600, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'10px 12px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8' },
}
const PURPLE = ['#3b0764','#6d28d9','#7c3aed','#a78bfa','#c4b5fd']
const BUCKET_TEST: Record<string, (v:number)=>boolean> = {
  '1 visit': v=>v===1, '2 visits': v=>v===2, '3-5 visits': v=>v>=3&&v<=5, '6-10 visits': v=>v>=6&&v<=10, '10+ visits': v=>v>10,
}

function NameLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background:'none', border:'none', padding:0, margin:0, font:'inherit', fontWeight:600, color:'#3b0764', cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd', textUnderlineOffset:2 }}>
      {children}
    </button>
  )
}

function OrderLink({ voucherNo, onClick }: { voucherNo: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background:'none', border:'none', padding:0, margin:0, font:'inherit', fontWeight:600, color:'#7c3aed', cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd', textUnderlineOffset:2 }}>
      {voucherNo}
    </button>
  )
}

function CustomersInner() {
  const { selectedBranch } = useBranch()
  const searchParams = useSearchParams()
  const deepDiveRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [bills, setBills] = useState<any[]>([])
  const [lines, setLines] = useState<any[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [orderVoucher, setOrderVoucher] = useState<string | null>(null)

  // Insights state
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [freqData, setFreqData] = useState<any[]>([])
  const [insightMetrics, setInsightMetrics] = useState({ total:0, returning:0, single:0, repeat_pct:0, avg_spend:0, top_spend:0 })
  const [insightsLoading, setInsightsLoading] = useState(false)
  const { grain: iGrain, offset: iOffset, setGrain: setIGrain, setOffset: setIOffset } = useDateRange()
  const iRange = getDateRange(iGrain, iOffset)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  // Load insights — scoped to the selected period
  useEffect(() => {
    const load = async () => {
      setInsightsLoading(true)
      setSelectedBucket(null)
      try {
        const sales = await fetchAllRows('sales', 'voucher_no,customer_name,mobile_no,net_amount,profit,qty,date', q => {
          let qq = q.gte('date', iRange.from).lte('date', iRange.to)
          if (selectedBranch) qq = qq.eq('branch_id', selectedBranch)
          return qq
        })
        if (!sales.length) {
          setInsightMetrics({ total:0, returning:0, single:0, repeat_pct:0, avg_spend:0, top_spend:0 })
          setFreqData([]); setAllCustomers([])
          return
        }

        const map: Record<string, any> = {}
        for (const r of sales) {
          const key = r.mobile_no || r.customer_name || 'unknown'
          if (!map[key]) map[key] = { customer_name: r.customer_name||'Walk-in', mobile_no: r.mobile_no, vouchers: new Set<string>(), total_spend:0, total_profit:0, total_units:0, first_visit: r.date, last_visit: r.date }
          map[key].vouchers.add(r.voucher_no)
          map[key].total_spend += r.net_amount||0
          map[key].total_profit += r.profit||0
          map[key].total_units += r.qty||0
          if (r.date < map[key].first_visit) map[key].first_visit = r.date
          if (r.date > map[key].last_visit) map[key].last_visit = r.date
        }
        const cust = Object.values(map).map((c:any)=>({ ...c, visit_count: c.vouchers.size })).sort((a:any,b:any)=>b.total_spend-a.total_spend)
        setAllCustomers(cust)

        const total = cust.length
        const returning = cust.filter((c:any)=>c.visit_count>1).length
        const avgSpend = cust.reduce((s:number,c:any)=>s+(c.total_spend||0),0)/total
        const topS = cust[0]?.total_spend||0

        setInsightMetrics({ total, returning, single:total-returning, repeat_pct:total?returning/total*100:0, avg_spend:avgSpend, top_spend:topS })

        const freqMap: Record<string,number> = { '1 visit':0, '2 visits':0, '3-5 visits':0, '6-10 visits':0, '10+ visits':0 }
        for (const c of cust) {
          if (c.visit_count===1) freqMap['1 visit']++
          else if (c.visit_count===2) freqMap['2 visits']++
          else if (c.visit_count<=5) freqMap['3-5 visits']++
          else if (c.visit_count<=10) freqMap['6-10 visits']++
          else freqMap['10+ visits']++
        }
        setFreqData(Object.entries(freqMap).map(([name,count])=>({name,count,pct:total?+(count/total*100).toFixed(1):0})))
      } finally { setInsightsLoading(false) }
    }
    load()
  }, [iRange.from, iRange.to, selectedBranch])

  // Derived tables — recomputed instantly from allCustomers, no re-fetch needed
  const topFreq = (selectedBucket
    ? [...allCustomers].filter(c=>BUCKET_TEST[selectedBucket]?.(c.visit_count)).sort((a,b)=>b.visit_count-a.visit_count)
    : [...allCustomers].sort((a,b)=>b.visit_count-a.visit_count)
  ).slice(0, selectedBucket ? undefined : 10)
  const topSpend = allCustomers.slice(0,10)

  const openErp = (productId?: string) => {
    const url = vasyErpProductUrl(productId)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Customer search suggestions
  useEffect(() => {
    if (search.length<2) { setOptions([]); return }
    const t = setTimeout(async () => {
      const isPhone = /^\d+$/.test(search)
      const q = supabase.from('sales').select('customer_name,mobile_no').limit(300)
      const { data } = isPhone ? await q.ilike('mobile_no',`%${search}%`) : await q.ilike('customer_name',`%${search}%`)
      if (!data) return
      const seen = new Set<string>(); const opts: any[] = []
      for (const r of data) {
        const key = `${r.customer_name}||${r.mobile_no}`
        if (seen.has(key)) continue; seen.add(key)
        opts.push({ name:r.customer_name||'Unknown', mobile:r.mobile_no||'', display:r.mobile_no?`${r.customer_name} — ${r.mobile_no}`:r.customer_name })
      }
      setOptions(opts.slice(0,10)); setShowDrop(true)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadCustomer = useCallback(async (cust: any) => {
    setSelected(cust); setShowDrop(false); setSearch(cust.display); setLoadingSearch(true)
    try {
      const q = supabase.from('sales').select('*').limit(5000)
      const { data } = cust.mobile ? await q.eq('mobile_no',cust.mobile) : await q.eq('customer_name',cust.name)
      if (!data) return
      const billMap: Record<string,any> = {}
      for (const r of data) {
        const v = r.voucher_no
        if (!billMap[v]) billMap[v] = { voucher_no:v, date:r.date, sales_man:r.sales_man||'', items:0, unique_products:0, net_amount:0, profit:0, discount:0 }
        billMap[v].items += r.qty||0; billMap[v].net_amount += r.net_amount||0; billMap[v].profit += r.profit||0; billMap[v].discount += r.other_discount||0
      }
      const billList = Object.values(billMap).sort((a,b)=>parseDate(b.date).getTime()-parseDate(a.date).getTime())
      for (const b of billList) b.unique_products = data.filter(r=>r.voucher_no===b.voucher_no).length
      setBills(billList)
      setLines(data.sort((a,b)=>parseDate(b.date).getTime()-parseDate(a.date).getTime()))
    } finally { setLoadingSearch(false) }
  }, [])

  const jumpToCustomer = useCallback((name: string, mobile?: string) => {
    if (!name) return
    const cust = { name, mobile: mobile||'', display: mobile ? `${name} — ${mobile}` : name }
    loadCustomer(cust)
    setTimeout(() => deepDiveRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 60)
  }, [loadCustomer])

  useEffect(() => {
    const name = searchParams.get('name')
    if (name) jumpToCustomer(name, searchParams.get('mobile') || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const totalSpend = bills.reduce((s,b)=>s+b.net_amount,0)
  const totalProfit = bills.reduce((s,b)=>s+b.profit,0)
  const totalDisc = bills.reduce((s,b)=>s+b.discount,0)
  const margin = totalSpend>0?totalProfit/totalSpend*100:0
  const firstVisit = bills.length?format(parseDate(bills[bills.length-1].date),'dd MMM yyyy'):''
  const lastVisit  = bills.length?format(parseDate(bills[0].date),'dd MMM yyyy'):''

  const Tip = ({ active, payload, label }: any) => {
    if (!active||!payload?.length) return null
    return (
      <div style={{ background:'#fff', border:'1px solid #e8d5b7', borderRadius:12, padding:'10px 14px', fontSize:12 }}>
        <p style={{ fontWeight:700, color:'#3b0764', marginBottom:4 }}>{label}</p>
        {payload.map((p:any)=>(<div key={p.name} style={{ display:'flex', gap:8 }}><span style={{ color:'#6b5b7b' }}>{p.name}:</span><span style={{ fontWeight:600 }}>{p.value}</span></div>))}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Customers" subtitle="Insights and individual deep dives" />
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* ═══════════ INSIGHTS ═══════════ */}
        <DateNav grain={iGrain} onGrainChange={setIGrain} offset={iOffset} onOffsetChange={setIOffset} label={iRange.label} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14 }}>
          <MetricCard label="Total Customers" value={fmt_num(insightMetrics.total)} sub="With phone" accent="purple"/>
          <MetricCard label="Single Visit" value={fmt_num(insightMetrics.single)} sub={`${(100-insightMetrics.repeat_pct).toFixed(1)}% of total`} accent="beige"/>
          <MetricCard label="Repeat Customers" value={fmt_num(insightMetrics.returning)} sub={`${insightMetrics.repeat_pct.toFixed(1)}% retention`} accent="green"/>
          <MetricCard label="Avg Lifetime Spend" value={fmt_inr(insightMetrics.avg_spend)} accent="beige"/>
          <MetricCard label="Top Customer Spend" value={fmt_inr(insightMetrics.top_spend)} accent="purple"/>
          <MetricCard label="Returning Rate" value={`${insightMetrics.repeat_pct.toFixed(1)}%`} sub="2+ visits" accent="green"/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div style={{ ...S.section, padding:24 }}>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:16, margin:'0 0 16px' }}>Visit Frequency Distribution</h2>
            <p style={{ fontSize:11, color:'#6b5b7b', margin:'-12px 0 12px' }}>Click a bar to filter the table beside it</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={freqData} margin={{ top:4,right:8,left:0,bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8d5b7"/>
                <XAxis dataKey="name" tick={{ fontSize:10,fill:'#6b5b7b' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:10,fill:'#6b5b7b' }} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="count" name="Customers" radius={[4,4,0,0]} cursor="pointer" onClick={(d:any)=>setSelectedBucket(prev=>prev===d.name?null:d.name)}>
                  {freqData.map((d,i)=><Cell key={i} fill={PURPLE[i%PURPLE.length]} opacity={selectedBucket&&selectedBucket!==d.name?0.35:1}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              {freqData.map((d,i)=>(
                <div key={d.name} onClick={()=>setSelectedBucket(prev=>prev===d.name?null:d.name)} style={{ cursor:'pointer', background:selectedBucket===d.name?'#ede9ff':'#f5f0e8', border:selectedBucket===d.name?'1px solid #7c3aed':'1px solid transparent', borderRadius:8, padding:'6px 10px', textAlign:'center', flex:1 }}>
                  <p style={{ fontSize:16, fontWeight:700, color:PURPLE[i%PURPLE.length], margin:0 }}>{d.pct}%</p>
                  <p style={{ fontSize:9, color:'#6b5b7b', margin:'2px 0 0' }}>{d.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={S.section}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <h2 className="font-display" style={{ color:'#3b0764', fontSize:16, margin:0 }}>{selectedBucket?`Customers — ${selectedBucket}`:'Most Frequent Customers'}</h2>
                <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{selectedBucket?`${topFreq.length} customers in this bucket`:'By number of visits'} · click a name to open their deep dive below</p>
              </div>
              {selectedBucket&&<button onClick={()=>setSelectedBucket(null)} style={{ padding:'4px 10px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:11, cursor:'pointer', color:'#6b5b7b' }}>Clear ×</button>}
            </div>
            <div style={{ maxHeight:340, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr>{['Rank','Customer','Phone','Visits','Total Spend'].map(h=><th key={h} style={{...S.th, position:'sticky', top:0}}>{h}</th>)}</tr></thead>
                <tbody>
                  {topFreq.map((c,i)=>(
                    <tr key={c.mobile_no||c.customer_name+i} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight:700, color:i<3?'#f59e0b':'#6b5b7b', textAlign:'center' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                      <td style={S.td}><NameLink onClick={()=>jumpToCustomer(c.customer_name, c.mobile_no)}>{c.customer_name}</NameLink></td>
                      <td style={{ ...S.td, fontFamily:'monospace', color:'#6b5b7b', fontSize:11 }}>{c.mobile_no}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <span style={{ padding:'2px 8px', borderRadius:20, fontWeight:700, fontSize:11, background:'#ede9ff', color:'#3b0764' }}>{c.visit_count}×</span>
                      </td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#3b0764' }}>{fmt_inr(c.total_spend)}</td>
                    </tr>
                  ))}
                  {topFreq.length===0&&(
                    <tr><td colSpan={5} style={{ ...S.td, textAlign:'center', color:'#6b5b7b', padding:24 }}>No customers in this bucket</td></tr>
                  )}
                </tbody>
                {topFreq.length>0&&(
                  <tfoot>
                    <tr style={{ background:'#f5f0ff', borderTop:'2px solid #7c3aed', position:'sticky', bottom:0 }}>
                      <td colSpan={3} style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>TOTAL ({topFreq.length})</td>
                      <td style={{ ...S.td, textAlign:'center', fontWeight:700 }}>{topFreq.reduce((s,c)=>s+c.visit_count,0)}×</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#3b0764' }}>{fmt_inr(topFreq.reduce((s,c)=>s+c.total_spend,0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        <div style={S.section}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7' }}>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:16, margin:0 }}>Top Customers by Lifetime Spend</h2>
            <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{iRange.label} · customers with registered phone numbers · click a name to open their deep dive below</p>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['Rank','Customer','Phone','Visits','Total Spend','Total Profit','Margin','Units','First Visit','Last Visit'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {topSpend.map((c,i)=>{
                  const m = c.total_spend>0?c.total_profit/c.total_spend*100:0
                  return (
                    <tr key={c.mobile_no||c.customer_name+i} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, fontWeight:700, color:i<3?'#f59e0b':'#6b5b7b', textAlign:'center' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                      <td style={S.td}><NameLink onClick={()=>jumpToCustomer(c.customer_name, c.mobile_no)}>{c.customer_name}</NameLink></td>
                      <td style={{ ...S.td, fontFamily:'monospace', color:'#6b5b7b', fontSize:11 }}>{c.mobile_no}</td>
                      <td style={{ ...S.td, textAlign:'center' }}>
                        <span style={{ padding:'2px 8px', borderRadius:20, fontWeight:700, fontSize:11, background:'#ede9ff', color:'#3b0764' }}>{c.visit_count}×</span>
                      </td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#3b0764' }}>{fmt_inr(c.total_spend)}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#059669', fontWeight:600 }}>{fmt_inr(c.total_profit)}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:m>=40?'#059669':m>=25?'#d97706':'#dc2626' }}>{fmt_pct(m)}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{fmt_num(c.total_units)}</td>
                      <td style={{ ...S.td, color:'#6b5b7b' }}>{c.first_visit?format(parseDate(c.first_visit),'dd MMM yy'):'—'}</td>
                      <td style={{ ...S.td, color:'#6b5b7b' }}>{c.last_visit?format(parseDate(c.last_visit),'dd MMM yy'):'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              {topSpend.length>0&&(
                <tfoot>
                  <tr style={{ background:'#f5f0ff', borderTop:'2px solid #7c3aed' }}>
                    <td colSpan={3} style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>TOTAL ({topSpend.length})</td>
                    <td style={{ ...S.td, textAlign:'center', fontWeight:700 }}>{topSpend.reduce((s:number,c:any)=>s+c.visit_count,0)}×</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#3b0764' }}>{fmt_inr(topSpend.reduce((s:number,c:any)=>s+c.total_spend,0))}</td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(topSpend.reduce((s:number,c:any)=>s+c.total_profit,0))}</td>
                    <td style={S.td}></td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#6b5b7b' }}>{fmt_num(topSpend.reduce((s:number,c:any)=>s+c.total_units,0))}</td>
                    <td style={S.td}></td>
                    <td style={S.td}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ═══════════ DEEP DIVE (bottom section) ═══════════ */}
        <div ref={deepDiveRef} id="deep-dive" style={{ marginTop:12, paddingTop:24, borderTop:'2px solid #e8d5b7', display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <h2 className="font-display" style={{ color:'#3b0764', fontSize:20, margin:'0 0 4px' }}>🔍 Customer Deep Dive</h2>
            <p style={{ fontSize:12, color:'#6b5b7b', margin:0 }}>Search any customer by name or phone number for their full order history</p>
          </div>

          <div style={{ position:'relative', maxWidth:520 }}>
            <div style={{ position:'relative' }}>
              <Search size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#6b5b7b' }}/>
              <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null)}}
                onFocus={()=>options.length>0&&setShowDrop(true)} placeholder="Search by name or phone number..."
                style={{ width:'100%', padding:'12px 14px 12px 40px', borderRadius:12, border:'1px solid #e8d5b7', background:'#fff', fontSize:14, color:'#1a0a2e', outline:'none' }}/>
            </div>
            {showDrop&&options.length>0&&(
              <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'#fff', border:'1px solid #e8d5b7', borderRadius:12, boxShadow:'0 8px 32px rgba(59,7,100,0.16)', zIndex:20 }}>
                {options.map(opt=>(
                  <button key={opt.display} onClick={()=>loadCustomer(opt)}
                    style={{ width:'100%', textAlign:'left', padding:'10px 16px', fontSize:13, background:'none', border:'none', cursor:'pointer', borderBottom:'1px solid #f0e8d8', color:'#1a0a2e' }}>
                    <span style={{ fontWeight:600 }}>{opt.name}</span>
                    {opt.mobile&&<span style={{ color:'#6b5b7b', marginLeft:8, fontSize:12 }}>{opt.mobile}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!selected&&(
            <div style={{ textAlign:'center', padding:'60px 0', color:'#6b5b7b' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>👤</div>
              <p style={{ fontSize:16, fontWeight:500 }}>Search for a customer above, or click any customer name higher up on this page</p>
            </div>
          )}

          {selected&&(
            <>
              <div style={{ background:'#3b0764', borderRadius:16, padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <h2 className="font-display" style={{ color:'#fff', fontSize:20, margin:0 }}>{selected.name}</h2>
                  <p style={{ color:'#c4b5fd', fontSize:13, marginTop:4 }}>{selected.mobile&&`${selected.mobile} · `}First: {firstVisit} · Last: {lastVisit}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'#c4b5fd', fontSize:11, margin:0 }}>Lifetime Spend</p>
                  <p style={{ color:'#fff', fontSize:24, fontWeight:700, margin:'4px 0 0' }}>{fmt_inr(totalSpend)}</p>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
                <MetricCard label="Visits" value={`${bills.length}`} accent="purple"/>
                <MetricCard label="Units" value={fmt_num(lines.reduce((s,l)=>s+(l.qty||0),0))} accent="beige"/>
                <MetricCard label="Avg Bill" value={fmt_inr(bills.length?totalSpend/bills.length:0)} accent="beige"/>
                <MetricCard label="Total Spend" value={fmt_inr(totalSpend)} accent="purple"/>
                <MetricCard label="Discount" value={fmt_inr(totalDisc)} accent="amber"/>
                <MetricCard label="Margin" value={fmt_pct(margin)} accent="green"/>
              </div>

              {loadingSearch?<div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>:(
                <div style={S.section}>
                  <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7' }}>
                    <h3 className="font-display" style={{ color:'#3b0764', fontSize:15, margin:0 }}>Invoice History</h3>
                    <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{bills.length} bills · {fmt_inr(totalSpend)} · click a bill no. for full order details</p>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr>{['Visit','Date','Bill No','Sales Person','Items','Products','Amount','Discount','Profit','Margin'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {bills.map((b,i)=>{
                          const m=b.net_amount>0?b.profit/b.net_amount*100:0
                          const vn=bills.length-i, sfx=vn===1?'st':vn===2?'nd':vn===3?'rd':'th'
                          return (
                            <tr key={b.voucher_no} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                              <td style={{ ...S.td, fontWeight:700, color:'#7c3aed' }}>{vn}<sup style={{fontSize:8}}>{sfx}</sup></td>
                              <td style={S.td}>{format(parseDate(b.date),'dd MMM yyyy')}</td>
                              <td style={S.td}><OrderLink voucherNo={b.voucher_no} onClick={()=>setOrderVoucher(b.voucher_no)}/></td>
                              <td style={{ ...S.td, color:'#6b5b7b' }}>{b.sales_man}</td>
                              <td style={{ ...S.td, textAlign:'right' }}>{fmt_num(b.items)}</td>
                              <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{b.unique_products}</td>
                              <td style={{ ...S.td, textAlign:'right', fontWeight:600 }}>{fmt_inr(b.net_amount)}</td>
                              <td style={{ ...S.td, textAlign:'right', color:'#d97706' }}>{b.discount>0?fmt_inr(b.discount):'—'}</td>
                              <td style={{ ...S.td, textAlign:'right', color:'#059669', fontWeight:600 }}>{fmt_inr(b.profit)}</td>
                              <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:m>=40?'#059669':m>=25?'#d97706':'#dc2626' }}>{fmt_pct(m)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {bills.length>0&&(
                        <tfoot>
                          <tr style={{ background:'#f5f0ff', borderTop:'2px solid #7c3aed' }}>
                            <td colSpan={4} style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>TOTAL ({bills.length} bills)</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_num(bills.reduce((s,b)=>s+b.items,0))}</td>
                            <td style={S.td}></td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_inr(totalSpend)}</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#d97706' }}>{fmt_inr(totalDisc)}</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#059669' }}>{fmt_inr(totalProfit)}</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_pct(margin)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {!loadingSearch&&lines.length>0&&(
                <div style={S.section}>
                  <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7' }}>
                    <h3 className="font-display" style={{ color:'#3b0764', fontSize:15, margin:0 }}>Item Detail</h3>
                    <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{lines.length} line items · click a bill no. for full order details</p>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr>{['Date','Bill','Barcode','Product','Category','Brand','Qty','Cost','Sold At','Margin'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {lines.map((l,i)=>{
                          const m=l.net_amount>0?l.profit/l.net_amount*100:0
                          return (
                            <tr key={`${l.voucher_no}-${l.item_code}-${i}`} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                              <td style={{ ...S.td, color:'#6b5b7b' }}>{format(parseDate(l.date),'dd MMM yy')}</td>
                              <td style={S.td}><OrderLink voucherNo={l.voucher_no} onClick={()=>setOrderVoucher(l.voucher_no)}/></td>
                              <td onClick={()=>openErp(l.product_id)} title="Open in VasyERP" style={{ ...S.td, fontFamily:'monospace', color:'#3b0764', fontSize:10, cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd' }}>{l.item_code}</td>
                              <td onClick={()=>openErp(l.product_id)} title="Open in VasyERP" style={{ ...S.td, fontWeight:600, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#3b0764', cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd' }}>{l.product_name}</td>
                              <td style={{ ...S.td, color:'#6b5b7b' }}>{l.category}</td>
                              <td style={{ ...S.td, color:'#6b5b7b' }}>{l.brand}</td>
                              <td style={{ ...S.td, textAlign:'right' }}>{l.qty}</td>
                              <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{fmt_inr(l.landing_cost)}</td>
                              <td style={{ ...S.td, textAlign:'right', fontWeight:600 }}>{fmt_inr(l.net_amount)}</td>
                              <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:m>=40?'#059669':m>=25?'#d97706':'#dc2626' }}>{fmt_pct(m)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {lines.length>0&&(
                        <tfoot>
                          <tr style={{ background:'#f5f0ff', borderTop:'2px solid #7c3aed' }}>
                            <td colSpan={6} style={{ ...S.td, fontWeight:700, color:'#3b0764' }}>TOTAL ({lines.length} items)</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_num(lines.reduce((s,l)=>s+(l.qty||0),0))}</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700, color:'#6b5b7b' }}>{fmt_inr(lines.reduce((s,l)=>s+(l.landing_cost||0),0))}</td>
                            <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_inr(lines.reduce((s,l)=>s+(l.net_amount||0),0))}</td>
                            <td style={S.td}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {orderVoucher && <OrderModal voucherNo={orderVoucher} onClose={()=>setOrderVoucher(null)} />}
    </div>
  )
}

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersInner />
    </Suspense>
  )
}
