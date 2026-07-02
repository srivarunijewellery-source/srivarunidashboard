'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num, getDateRange, getAgeInDays, getAgeBadge, type Grain } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import GrainSelector from '@/components/ui/GrainSelector'
import MetricCard from '@/components/ui/MetricCard'
import ProductCard from '@/components/inventory/ProductCard'
import { ChevronLeft, ChevronRight, LayoutGrid, TableProperties } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewMode = 'sold' | 'snapshot'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SoldItem {
  item_code: string
  product_name: string
  category: string
  brand: string
  image_url: string
  mrp: number
  selling_price: number
  landing_cost: number
  qty_sold: number
  qty_remaining: number
  revenue: number
  profit: number
  vendor?: string
  age_days?: number
}

interface PivotCell {
  qty: number
  value: number
}

interface PivotRow {
  category: string
  total: PivotCell
  brands: Record<string, PivotCell>
}

interface DrillItem {
  item_code: string
  product_name: string
  category: string
  brand: string
  qty: number
  mrp: number
  purchase_price: number
  image_url: string
  age_days: number
}

export default function InventoryPage() {
  const [view, setView] = useState<ViewMode>('sold')
  const [grain, setGrain] = useState<Grain>('day')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // Sold view state
  const [soldItems, setSoldItems] = useState<SoldItem[]>([])
  const [metrics, setMetrics] = useState({ revenue: 0, profit: 0, qty: 0, bills: 0 })
  const [loading, setLoading] = useState(false)

  // Snapshot state
  const [pivotData, setPivotData] = useState<PivotRow[]>([])
  const [allBrands, setAllBrands] = useState<string[]>([])
  const [drillKey, setDrillKey] = useState<{ cat: string; brand: string } | null>(null)
  const [drillItems, setDrillItems] = useState<DrillItem[]>([])
  const [snapLoading, setSnapLoading] = useState(false)

  const dateRange = getDateRange(grain, offset)

  // ── Load sold items ─────────────────────────────────────────────────────────
  const loadSold = useCallback(async () => {
    setLoading(true)
    try {
      // Aggregate sales in date range
      const { data: sales } = await supabase
        .from('sales')
        .select('item_code, product_name, category, brand, selling_price, landing_cost, mrp, qty, net_amount, profit')
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)

      if (!sales) return

      // Aggregate by item_code
      const agg: Record<string, SoldItem> = {}
      for (const s of sales) {
        const k = s.item_code
        if (!agg[k]) {
          agg[k] = {
            item_code: k,
            product_name: s.product_name || '',
            category: s.category || '',
            brand: s.brand || '',
            image_url: '',
            mrp: s.mrp || 0,
            selling_price: s.selling_price || 0,
            landing_cost: s.landing_cost || 0,
            qty_sold: 0,
            qty_remaining: 0,
            revenue: 0,
            profit: 0,
          }
        }
        agg[k].qty_sold += s.qty || 0
        agg[k].revenue += s.net_amount || 0
        agg[k].profit += s.profit || 0
      }

      const itemCodes = Object.keys(agg)
      if (itemCodes.length === 0) { setSoldItems([]); setLoading(false); return }

      // Get product details (image, stock, age)
      const { data: products } = await supabase
        .from('products')
        .select('item_code, image_url, qty, created_on, purchase_price')
        .in('item_code', itemCodes.slice(0, 500))

      // Get vendor info from purchases
      const { data: purchases } = await supabase
        .from('purchases')
        .select('item_code, supplier_name')
        .in('item_code', itemCodes.slice(0, 500))

      const prodMap: Record<string, { image_url: string; qty: number; created_on: string }> = {}
      for (const p of products || []) prodMap[p.item_code] = p

      const vendorMap: Record<string, string> = {}
      for (const p of purchases || []) {
        if (p.supplier_name && !vendorMap[p.item_code]) vendorMap[p.item_code] = p.supplier_name
      }

      // Enrich aggregated items
      const items: SoldItem[] = Object.values(agg).map(item => ({
        ...item,
        image_url: prodMap[item.item_code]?.image_url || '',
        qty_remaining: prodMap[item.item_code]?.qty || 0,
        age_days: prodMap[item.item_code]?.created_on
          ? getAgeInDays(prodMap[item.item_code].created_on)
          : undefined,
        vendor: vendorMap[item.item_code],
      }))

      // Sort by revenue desc
      items.sort((a, b) => b.revenue - a.revenue)
      setSoldItems(items)

      // Compute metrics
      setMetrics({
        revenue: items.reduce((s, i) => s + i.revenue, 0),
        profit: items.reduce((s, i) => s + i.profit, 0),
        qty: items.reduce((s, i) => s + i.qty_sold, 0),
        bills: new Set(sales.map(s => s.item_code)).size,
      })
    } finally {
      setLoading(false)
    }
  }, [dateRange.from, dateRange.to])

  // ── Load snapshot pivot ─────────────────────────────────────────────────────
  const loadSnapshot = useCallback(async () => {
    setSnapLoading(true)
    try {
      const { data: products } = await supabase
        .from('products')
        .select('item_code, category, brand, qty, mrp, purchase_price')
        .gt('qty', 0)

      if (!products) return

      const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort()
      setAllBrands(brands)

      const pivotMap: Record<string, PivotRow> = {}
      for (const p of products) {
        const cat = p.category || 'Other'
        const br = p.brand || 'Unknown'
        const val = (p.purchase_price || 0) * (p.qty || 0)

        if (!pivotMap[cat]) {
          pivotMap[cat] = { category: cat, total: { qty: 0, value: 0 }, brands: {} }
        }
        pivotMap[cat].total.qty += p.qty || 0
        pivotMap[cat].total.value += val
        if (!pivotMap[cat].brands[br]) pivotMap[cat].brands[br] = { qty: 0, value: 0 }
        pivotMap[cat].brands[br].qty += p.qty || 0
        pivotMap[cat].brands[br].value += val
      }

      const rows = Object.values(pivotMap).sort((a, b) => b.total.value - a.total.value)
      setPivotData(rows)
    } finally {
      setSnapLoading(false)
    }
  }, [])

  // ── Drill-down ──────────────────────────────────────────────────────────────
  const loadDrill = useCallback(async (cat: string, brand: string) => {
    setDrillKey({ cat, brand })
    const q = supabase.from('products').select('item_code, product_name, category, brand, qty, mrp, purchase_price, image_url, created_on').gt('qty', 0)
    const filtered = cat !== 'ALL' ? q.eq('category', cat) : q
    const filtered2 = brand !== 'ALL' ? filtered.eq('brand', brand) : filtered
    const { data } = await filtered2.order('qty', { ascending: false })
    setDrillItems((data || []).map(d => ({
      ...d,
      age_days: d.created_on ? getAgeInDays(d.created_on) : 0
    })))
  }, [])

  useEffect(() => {
    if (view === 'sold') loadSold()
    else loadSnapshot()
  }, [view, loadSold, loadSnapshot])

  const pageItems = soldItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(soldItems.length / PAGE_SIZE)
  const margin = metrics.revenue > 0 ? (metrics.profit / metrics.revenue * 100) : 0

  return (
    <div className="min-h-full">
      <PageHeader
        title="Inventory"
        subtitle="Sold items and stock snapshot"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('sold')}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                view === 'sold' ? 'bg-sv-purple text-white border-sv-purple' : 'border-sv-beige-dark text-sv-muted hover:border-sv-purple')}
            >
              <LayoutGrid size={14} /> Sold Items
            </button>
            <button
              onClick={() => setView('snapshot')}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                view === 'snapshot' ? 'bg-sv-purple text-white border-sv-purple' : 'border-sv-beige-dark text-sv-muted hover:border-sv-purple')}
            >
              <TableProperties size={14} /> Stock Snapshot
            </button>
          </div>
        }
      />

      <div className="px-8 pb-8 space-y-6">

        {/* ── SOLD ITEMS VIEW ── */}
        {view === 'sold' && (
          <>
            {/* Controls */}
            <div className="flex items-center justify-between">
              <GrainSelector value={grain} onChange={g => { setGrain(g); setOffset(0); setPage(0) }} />
              <div className="flex items-center gap-2">
                <button onClick={() => setOffset(o => o + 1)} className="p-2 rounded-lg border border-sv-beige-dark hover:border-sv-purple text-sv-muted hover:text-sv-purple transition-all">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-sv-ink min-w-[120px] text-center">{dateRange.label}</span>
                <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} className="p-2 rounded-lg border border-sv-beige-dark hover:border-sv-purple text-sv-muted hover:text-sv-purple disabled:opacity-40 transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <MetricCard label="Revenue" value={fmt_inr(metrics.revenue)} sub={dateRange.label} accent="purple" />
              <MetricCard label="Profit" value={fmt_inr(metrics.profit)} sub={`${margin.toFixed(1)}% margin`} accent="green" />
              <MetricCard label="Units Sold" value={fmt_num(metrics.qty)} sub="Across all items" accent="beige" />
              <MetricCard label="Unique Products" value={fmt_num(soldItems.length)} sub="Distinct SKUs" accent="beige" />
            </div>

            {/* Cards grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl aspect-[3/4] animate-pulse border border-sv-beige-dark" />
                ))}
              </div>
            ) : soldItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-sv-muted">
                <span className="text-5xl mb-4">💍</span>
                <p className="text-lg font-medium">No sales for {dateRange.label}</p>
                <p className="text-sm mt-1">Try a different date range</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {pageItems.map(item => (
                    <ProductCard key={item.item_code} {...item} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-4 py-2 rounded-lg border border-sv-beige-dark text-sm font-medium text-sv-muted hover:border-sv-purple hover:text-sv-purple disabled:opacity-40 transition-all">
                      ← Previous
                    </button>
                    <span className="text-sm text-sv-muted">
                      {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, soldItems.length)} of {soldItems.length}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-4 py-2 rounded-lg border border-sv-beige-dark text-sm font-medium text-sv-muted hover:border-sv-purple hover:text-sv-purple disabled:opacity-40 transition-all">
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── SNAPSHOT PIVOT VIEW ── */}
        {view === 'snapshot' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg text-sv-purple">Current Stock — Category × Brand</h2>
                <p className="text-xs text-sv-muted mt-0.5">Click any cell to drill into product detail</p>
              </div>
            </div>

            {snapLoading ? (
              <div className="bg-white rounded-2xl border border-sv-beige-dark p-8 animate-pulse h-64" />
            ) : (
              <div className="bg-white rounded-2xl border border-sv-beige-dark overflow-auto shadow-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-sv-purple text-white">
                      <th className="text-left px-4 py-3 font-semibold sticky left-0 bg-sv-purple min-w-[160px]">Category</th>
                      <th
                        className="px-3 py-3 font-semibold text-right cursor-pointer hover:bg-purple-800 whitespace-nowrap"
                        onClick={() => loadDrill('ALL', 'ALL')}
                      >TOTAL</th>
                      {allBrands.map(b => (
                        <th key={b} className="px-3 py-3 font-semibold text-right whitespace-nowrap min-w-[100px]">{b}</th>
                      ))}
                    </tr>
                    <tr className="bg-purple-800 text-purple-200 text-[10px]">
                      <th className="px-4 py-1.5 sticky left-0 bg-purple-800" />
                      <th className="px-3 py-1.5 text-right">Qty · Value</th>
                      {allBrands.map(b => (
                        <th key={b} className="px-3 py-1.5 text-right">Qty · Value</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.map((row, ri) => (
                      <tr key={row.category} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', ri % 2 === 0 ? '' : 'bg-sv-beige/30')}>
                        <td
                          className="px-4 py-2.5 font-semibold text-sv-purple sticky left-0 bg-inherit cursor-pointer hover:underline"
                          onClick={() => loadDrill(row.category, 'ALL')}
                        >
                          {row.category}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="font-bold text-sv-ink">{fmt_num(row.total.qty)}</div>
                          <div className="text-sv-muted">{fmt_inr(row.total.value)}</div>
                        </td>
                        {allBrands.map(b => {
                          const cell = row.brands[b]
                          return (
                            <td
                              key={b}
                              className={cn('px-3 py-2.5 text-right cursor-pointer rounded transition-colors',
                                cell ? 'hover:bg-sv-purple-pale' : 'text-sv-beige-dark')}
                              onClick={() => cell && loadDrill(row.category, b)}
                            >
                              {cell ? (
                                <>
                                  <div className="font-medium text-sv-ink">{fmt_num(cell.qty)}</div>
                                  <div className="text-sv-muted">{fmt_inr(cell.value)}</div>
                                </>
                              ) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Drill-down table */}
            {drillKey && drillItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-sv-beige-dark overflow-hidden shadow-card">
                <div className="px-5 py-4 border-b border-sv-beige-dark flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sv-purple">
                      {drillKey.cat === 'ALL' ? 'All Products' : drillKey.brand === 'ALL' ? drillKey.cat : `${drillKey.cat} — ${drillKey.brand}`}
                    </h3>
                    <p className="text-xs text-sv-muted mt-0.5">{drillItems.length} products in stock</p>
                  </div>
                  <button onClick={() => setDrillKey(null)} className="text-xs text-sv-muted hover:text-sv-ink px-3 py-1.5 rounded-lg border border-sv-beige-dark">
                    Close ×
                  </button>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-sv-beige border-b border-sv-beige-dark">
                        <th className="text-left px-4 py-3 font-semibold text-sv-muted">Item</th>
                        <th className="text-left px-3 py-3 font-semibold text-sv-muted">Category</th>
                        <th className="text-left px-3 py-3 font-semibold text-sv-muted">Brand</th>
                        <th className="text-right px-3 py-3 font-semibold text-sv-muted">Stock</th>
                        <th className="text-right px-3 py-3 font-semibold text-sv-muted">MRP</th>
                        <th className="text-right px-3 py-3 font-semibold text-sv-muted">Cost</th>
                        <th className="text-right px-3 py-3 font-semibold text-sv-muted">Stock Value</th>
                        <th className="text-right px-3 py-3 font-semibold text-sv-muted">Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillItems.map((item, i) => {
                        const badge = getAgeBadge(item.age_days)
                        return (
                          <tr key={item.item_code} className={cn('border-t border-sv-beige-dark hover:bg-sv-beige-mid transition-colors', i % 2 === 0 ? '' : 'bg-sv-beige/20')}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {item.image_url && (
                                  <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-sv-beige-dark flex-shrink-0" />
                                )}
                                <div>
                                  <p className="font-medium text-sv-ink line-clamp-1">{item.product_name}</p>
                                  <p className="text-sv-muted font-mono">{item.item_code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-sv-muted">{item.category}</td>
                            <td className="px-3 py-2.5 text-sv-muted">{item.brand}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-sv-ink">{item.qty}</td>
                            <td className="px-3 py-2.5 text-right text-sv-ink">{fmt_inr(item.mrp)}</td>
                            <td className="px-3 py-2.5 text-right text-sv-muted">{fmt_inr(item.purchase_price)}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-sv-ink">{fmt_inr(item.purchase_price * item.qty)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={cn('px-2 py-0.5 rounded-full font-bold', badge.color)}>{badge.label}</span>
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
