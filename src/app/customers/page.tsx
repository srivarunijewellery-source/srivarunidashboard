'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, fmt_pct, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { Search } from 'lucide-react'
import { format } from 'date-fns'

interface CustomerOption { name: string; mobile: string; display: string }
interface Bill {
  voucher_no: string; date: string; sales_man: string
  items: number; unique_products: number
  net_amount: number; profit: number; discount: number
}
interface LineItem {
  date: string; voucher_no: string; item_code: string; product_name: string
  category: string; brand: string; qty: number; selling_price: number
  landing_cost: number; net_amount: number; profit: number
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<CustomerOption[]>([])
  const [selected, setSelected] = useState<CustomerOption | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [lines, setLines] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Search customers
  useEffect(() => {
    if (search.length < 2) { setOptions([]); return }
    const timer = setTimeout(async () => {
      const isPhone = /^\d+$/.test(search)
      const q = supabase.from('sales').select('customer_name,mobile_no').limit(200)
      const { data } = isPhone
        ? await q.ilike('mobile_no', `%${search}%`)
        : await q.ilike('customer_name', `%${search}%`)

      if (!data) return
      const seen = new Set<string>()
      const opts: CustomerOption[] = []
      for (const r of data) {
        const key = `${r.customer_name}||${r.mobile_no}`
        if (seen.has(key)) continue
        seen.add(key)
        opts.push({
          name: r.customer_name || 'Unknown',
          mobile: r.mobile_no || '',
          display: r.mobile_no ? `${r.customer_name} — ${r.mobile_no}` : r.customer_name
        })
      }
      setOptions(opts.slice(0, 10))
      setShowDropdown(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadCustomer = useCallback(async (cust: CustomerOption) => {
    setSelected(cust)
    setShowDropdown(false)
    setSearch(cust.display)
    setLoading(true)
    try {
      const q = supabase.from('sales').select('*')
      const { data } = cust.mobile
        ? await q.eq('mobile_no', cust.mobile)
        : await q.eq('customer_name', cust.name)

      if (!data) return

      // Aggregate to bill level
      const billMap: Record<string, Bill> = {}
      for (const r of data) {
        const v = r.voucher_no
        if (!billMap[v]) billMap[v] = { voucher_no: v, date: r.date, sales_man: r.sales_man||'', items: 0, unique_products: 0, net_amount: 0, profit: 0, discount: 0 }
        billMap[v].items += r.qty||0
        billMap[v].net_amount += r.net_amount||0
        billMap[v].profit += r.profit||0
        billMap[v].discount += r.other_discount||0
      }
      const billList = Object.values(billMap).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      // unique products per bill
      for (const b of billList) {
        b.unique_products = data.filter(r => r.voucher_no === b.voucher_no).length
      }
      setBills(billList)

      const lineList: LineItem[] = data
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(r => ({
          date: r.date, voucher_no: r.voucher_no, item_code: r.item_code,
          product_name: r.product_name, category: r.category, brand: r.brand,
          qty: r.qty||0, selling_price: r.selling_price||0, landing_cost: r.landing_cost||0,
          net_amount: r.net_amount||0, profit: r.profit||0,
        }))
      setLines(lineList)
    } finally { setLoading(false) }
  }, [])

  const totalSpend = bills.reduce((s,b)=>s+b.net_amount,0)
  const totalProfit = bills.reduce((s,b)=>s+b.profit,0)
  const totalDiscount = bills.reduce((s,b)=>s+b.discount,0)
  const margin = totalSpend > 0 ? totalProfit/totalSpend*100 : 0
  const firstVisit = bills.length ? format(new Date(bills[bills.length-1].date),'dd MMM yyyy') : ''
  const lastVisit  = bills.length ? format(new Date(bills[0].date),'dd MMM yyyy') : ''

  return (
    <div className="min-h-full">
      <PageHeader title="Customer Deep Dive" subtitle="Search by name or phone number" />
      <div className="px-8 pb-8 space-y-6">

        {/* Search */}
        <div className="relative max-w-lg">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sv-muted" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              onFocus={() => options.length > 0 && setShowDropdown(true)}
              placeholder="Search by name or phone number..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-sv-beige-dark bg-white text-sv-ink placeholder:text-sv-muted text-sm focus:outline-none focus:border-sv-purple-light focus:ring-2 focus:ring-sv-purple-pale transition-all"
            />
          </div>
          {showDropdown && options.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sv-beige-dark rounded-xl shadow-card-hover z-20 overflow-hidden">
              {options.map(opt => (
                <button key={opt.display} onClick={() => loadCustomer(opt)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-sv-beige-mid transition-colors">
                  <span className="font-medium text-sv-ink">{opt.name}</span>
                  {opt.mobile && <span className="text-sv-muted ml-2 text-xs">{opt.mobile}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected && (
          <div className="flex flex-col items-center justify-center py-20 text-sv-muted">
            <span className="text-5xl mb-4">👤</span>
            <p className="text-lg font-medium">Search for a customer above</p>
            <p className="text-sm mt-1">Find by name or phone number</p>
          </div>
        )}

        {selected && (
          <>
            {/* Customer banner */}
            <div className="bg-sv-purple rounded-2xl px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl">{selected.name}</h2>
                <p className="text-purple-300 text-sm mt-0.5">
                  {selected.mobile && <span>{selected.mobile} · </span>}
                  First visit: {firstVisit} · Last visit: {lastVisit}
                </p>
              </div>
              <div className="text-right">
                <p className="text-purple-300 text-xs">Lifetime spend</p>
                <p className="text-2xl font-bold">{fmt_inr(totalSpend)}</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-6 gap-3">
              <MetricCard label="Visits" value={`${bills.length}`} sub="Total bills" accent="purple" />
              <MetricCard label="Units Bought" value={fmt_num(lines.reduce((s,l)=>s+l.qty,0))} sub="Total items" accent="beige" />
              <MetricCard label="Avg Bill" value={fmt_inr(bills.length?totalSpend/bills.length:0)} sub="Per visit" accent="beige" />
              <MetricCard label="Total Spend" value={fmt_inr(totalSpend)} accent="purple" />
              <MetricCard label="Discount Given" value={fmt_inr(totalDiscount)} sub="Total" accent="amber" />
              <MetricCard label="Margin %" value={fmt_pct(margin)} sub="On their sales" accent="green" />
            </div>

            {/* Bills table */}
            {loading ? <div className="h-48 bg-white rounded-2xl animate-pulse border border-sv-beige-dark" /> : (
              <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-sv-beige-dark">
                  <h3 className="font-display text-sv-purple text-lg">Invoice History</h3>
                  <p className="text-xs text-sv-muted mt-0.5">{bills.length} bills · {fmt_inr(totalSpend)} total</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-sv-beige border-b border-sv-beige-dark">
                        <th className="text-left px-5 py-3 font-semibold text-sv-muted">Visit</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Bill No</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Sales Person</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Items</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Products</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Amount</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Discount</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Profit</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b, i) => {
                        const m = b.net_amount > 0 ? b.profit/b.net_amount*100 : 0
                        const visitNo = bills.length - i
                        const sfx = visitNo===1?'st':visitNo===2?'nd':visitNo===3?'rd':'th'
                        return (
                          <tr key={b.voucher_no} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', i%2===0?'':'bg-sv-beige/20')}>
                            <td className="px-5 py-2.5 font-bold text-sv-purple">{visitNo}<sup className="text-[9px]">{sfx}</sup></td>
                            <td className="px-4 py-2.5 text-sv-ink">{format(new Date(b.date),'dd MMM yyyy')}</td>
                            <td className="px-4 py-2.5 text-sv-purple font-medium">{b.voucher_no}</td>
                            <td className="px-4 py-2.5 text-sv-muted">{b.sales_man}</td>
                            <td className="px-4 py-2.5 text-right text-sv-ink">{fmt_num(b.items)}</td>
                            <td className="px-4 py-2.5 text-right text-sv-muted">{b.unique_products}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-sv-ink">{fmt_inr(b.net_amount)}</td>
                            <td className="px-4 py-2.5 text-right text-amber-600">{b.discount>0?fmt_inr(b.discount):'—'}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{fmt_inr(b.profit)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={cn('font-bold', m>=40?'text-emerald-600':m>=25?'text-amber-600':'text-red-500')}>{fmt_pct(m)}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Line items */}
            {!loading && lines.length > 0 && (
              <div className="bg-white rounded-2xl border border-sv-beige-dark shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-sv-beige-dark">
                  <h3 className="font-display text-sv-purple text-lg">Item Detail</h3>
                  <p className="text-xs text-sv-muted mt-0.5">{lines.length} line items across all visits</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-sv-beige border-b border-sv-beige-dark">
                        <th className="text-left px-5 py-3 font-semibold text-sv-muted">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Bill</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Item Code</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Product</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Category</th>
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Brand</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Qty</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Cost</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Sold At</th>
                        <th className="text-right px-4 py-3 font-semibold text-sv-muted">Profit %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => {
                        const m = l.net_amount > 0 ? l.profit/l.net_amount*100 : 0
                        return (
                          <tr key={`${l.voucher_no}-${l.item_code}-${i}`} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', i%2===0?'':'bg-sv-beige/20')}>
                            <td className="px-5 py-2 text-sv-muted">{format(new Date(l.date),'dd MMM yyyy')}</td>
                            <td className="px-4 py-2 text-sv-purple font-medium">{l.voucher_no}</td>
                            <td className="px-4 py-2 font-mono text-sv-muted">{l.item_code}</td>
                            <td className="px-4 py-2 text-sv-ink font-medium max-w-[200px] truncate">{l.product_name}</td>
                            <td className="px-4 py-2 text-sv-muted">{l.category}</td>
                            <td className="px-4 py-2 text-sv-muted">{l.brand}</td>
                            <td className="px-4 py-2 text-right text-sv-ink">{l.qty}</td>
                            <td className="px-4 py-2 text-right text-sv-muted">{fmt_inr(l.landing_cost)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-sv-ink">{fmt_inr(l.net_amount)}</td>
                            <td className="px-4 py-2 text-right">
                              <span className={cn('font-bold', m>=40?'text-emerald-600':m>=25?'text-amber-600':'text-red-500')}>{fmt_pct(m)}</span>
                            </td>
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
