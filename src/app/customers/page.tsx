'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, fmt_pct } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { Search } from 'lucide-react'
import { format } from 'date-fns'

const S = {
  section: { background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7', boxShadow: '0 2px 8px rgba(59,7,100,0.07)', overflow: 'hidden' },
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase' as const, letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: 12, color: '#1a0a2e', borderBottom: '1px solid #f0e8d8' },
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [bills, setBills] = useState<any[]>([])
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showDrop, setShowDrop] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setOptions([]); return }
    const t = setTimeout(async () => {
      const isPhone = /^\d+$/.test(search)
      const q = supabase.from('sales').select('customer_name,mobile_no').limit(300)
      const { data } = isPhone ? await q.ilike('mobile_no', `%${search}%`) : await q.ilike('customer_name', `%${search}%`)
      if (!data) return
      const seen = new Set<string>(); const opts: any[] = []
      for (const r of data) {
        const key = `${r.customer_name}||${r.mobile_no}`
        if (seen.has(key)) continue; seen.add(key)
        opts.push({ name: r.customer_name||'Unknown', mobile: r.mobile_no||'', display: r.mobile_no?`${r.customer_name} — ${r.mobile_no}`:r.customer_name })
      }
      setOptions(opts.slice(0,10)); setShowDrop(true)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadCustomer = useCallback(async (cust: any) => {
    setSelected(cust); setShowDrop(false); setSearch(cust.display); setLoading(true)
    try {
      const q = supabase.from('sales').select('*')
      const { data } = cust.mobile ? await q.eq('mobile_no', cust.mobile) : await q.eq('customer_name', cust.name)
      if (!data) return
      const billMap: Record<string, any> = {}
      for (const r of data) {
        const v = r.voucher_no
        if (!billMap[v]) billMap[v] = { voucher_no: v, date: r.date, sales_man: r.sales_man||'', items: 0, unique_products: 0, net_amount: 0, profit: 0, discount: 0 }
        billMap[v].items += r.qty||0; billMap[v].net_amount += r.net_amount||0; billMap[v].profit += r.profit||0; billMap[v].discount += r.other_discount||0
      }
      const billList = Object.values(billMap).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())
      for (const b of billList) b.unique_products = data.filter(r=>r.voucher_no===b.voucher_no).length
      setBills(billList)
      setLines(data.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()))
    } finally { setLoading(false) }
  }, [])

  const totalSpend = bills.reduce((s,b)=>s+b.net_amount,0)
  const totalProfit = bills.reduce((s,b)=>s+b.profit,0)
  const totalDisc = bills.reduce((s,b)=>s+b.discount,0)
  const margin = totalSpend>0?totalProfit/totalSpend*100:0
  const firstVisit = bills.length?format(new Date(bills[bills.length-1].date),'dd MMM yyyy'):''
  const lastVisit  = bills.length?format(new Date(bills[0].date),'dd MMM yyyy'):''

  return (
    <div style={{ minHeight: '100%', background: '#f5f0e8' }}>
      <PageHeader title="Customer Deep Dive" subtitle="Search by name or phone number — all-time history" />
      <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 500 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b5b7b' }} />
            <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null)}}
              onFocus={()=>options.length>0&&setShowDrop(true)} placeholder="Search by name or phone..."
              style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid #e8d5b7', background: '#fff', fontSize: 14, color: '#1a0a2e', outline: 'none' }} />
          </div>
          {showDrop&&options.length>0&&(
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e8d5b7', borderRadius: 12, boxShadow: '0 8px 32px rgba(59,7,100,0.16)', zIndex: 20 }}>
              {options.map(opt=>(
                <button key={opt.display} onClick={()=>loadCustomer(opt)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f0e8d8', color: '#1a0a2e' }}>
                  <span style={{ fontWeight: 600 }}>{opt.name}</span>
                  {opt.mobile&&<span style={{ color: '#6b5b7b', marginLeft: 8, fontSize: 12 }}>{opt.mobile}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected&&(
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b5b7b' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <p style={{ fontSize: 16, fontWeight: 500 }}>Search for a customer above</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Find by name or phone number</p>
          </div>
        )}

        {selected&&(
          <>
            {/* Banner */}
            <div style={{ background: '#3b0764', borderRadius: 16, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="font-display" style={{ color: '#fff', fontSize: 20, margin: 0 }}>{selected.name}</h2>
                <p style={{ color: '#c4b5fd', fontSize: 13, marginTop: 4 }}>
                  {selected.mobile&&<span>{selected.mobile} · </span>}
                  First: {firstVisit} · Last: {lastVisit}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#c4b5fd', fontSize: 11, margin: 0 }}>Lifetime Spend</p>
                <p style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '4px 0 0' }}>{fmt_inr(totalSpend)}</p>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
              <MetricCard label="Visits" value={`${bills.length}`} sub="Total bills" accent="purple" />
              <MetricCard label="Units" value={fmt_num(lines.reduce((s,l)=>s+(l.qty||0),0))} sub="Items bought" accent="beige" />
              <MetricCard label="Avg Bill" value={fmt_inr(bills.length?totalSpend/bills.length:0)} accent="beige" />
              <MetricCard label="Total Spend" value={fmt_inr(totalSpend)} accent="purple" />
              <MetricCard label="Discount" value={fmt_inr(totalDisc)} accent="amber" />
              <MetricCard label="Margin" value={fmt_pct(margin)} sub="On their sales" accent="green" />
            </div>

            {/* Bills */}
            {loading ? <div style={{ height: 200, background: '#fff', borderRadius: 16, border: '1px solid #e8d5b7' }} /> : (
              <div style={S.section}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8d5b7' }}>
                  <h3 className="font-display" style={{ color: '#3b0764', fontSize: 16, margin: 0 }}>Invoice History</h3>
                  <p style={{ fontSize: 12, color: '#6b5b7b', marginTop: 2 }}>{bills.length} bills · {fmt_inr(totalSpend)} total</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>
                      {['Visit','Date','Bill No','Sales Person','Items','Products','Amount','Discount','Profit','Margin'].map(h=><th key={h} style={S.th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {bills.map((b,i)=>{
                        const m=b.net_amount>0?b.profit/b.net_amount*100:0
                        const vn=bills.length-i, sfx=vn===1?'st':vn===2?'nd':vn===3?'rd':'th'
                        return (
                          <tr key={b.voucher_no} style={{ background: i%2===0?'#fff':'#faf8ff' }}>
                            <td style={{ ...S.td, fontWeight: 700, color: '#7c3aed' }}>{vn}<sup style={{fontSize:8}}>{sfx}</sup></td>
                            <td style={S.td}>{format(new Date(b.date),'dd MMM yyyy')}</td>
                            <td style={{ ...S.td, color: '#7c3aed', fontWeight: 600 }}>{b.voucher_no}</td>
                            <td style={{ ...S.td, color: '#6b5b7b' }}>{b.sales_man}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmt_num(b.items)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: '#6b5b7b' }}>{b.unique_products}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmt_inr(b.net_amount)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: '#d97706' }}>{b.discount>0?fmt_inr(b.discount):'—'}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: '#059669', fontWeight: 600 }}>{fmt_inr(b.profit)}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: m>=40?'#059669':m>=25?'#d97706':'#dc2626' }}>{fmt_pct(m)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Line items */}
            {!loading&&lines.length>0&&(
              <div style={S.section}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8d5b7' }}>
                  <h3 className="font-display" style={{ color: '#3b0764', fontSize: 16, margin: 0 }}>Item Detail</h3>
                  <p style={{ fontSize: 12, color: '#6b5b7b', marginTop: 2 }}>{lines.length} line items across all visits</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>
                      {['Date','Bill','Barcode','Product','Category','Brand','Qty','Cost','Sold At','Margin'].map(h=><th key={h} style={S.th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {lines.map((l,i)=>{
                        const m=l.net_amount>0?l.profit/l.net_amount*100:0
                        return (
                          <tr key={`${l.voucher_no}-${l.item_code}-${i}`} style={{ background: i%2===0?'#fff':'#faf8ff' }}>
                            <td style={{ ...S.td, color: '#6b5b7b' }}>{format(new Date(l.date),'dd MMM yyyy')}</td>
                            <td style={{ ...S.td, color: '#7c3aed', fontWeight: 600 }}>{l.voucher_no}</td>
                            <td style={{ ...S.td, fontFamily: 'monospace', color: '#6b5b7b', fontSize: 11 }}>{l.item_code}</td>
                            <td style={{ ...S.td, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.product_name}</td>
                            <td style={{ ...S.td, color: '#6b5b7b' }}>{l.category}</td>
                            <td style={{ ...S.td, color: '#6b5b7b' }}>{l.brand}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{l.qty}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: '#6b5b7b' }}>{fmt_inr(l.landing_cost)}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmt_inr(l.net_amount)}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: m>=40?'#059669':m>=25?'#d97706':'#dc2626' }}>{fmt_pct(m)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
