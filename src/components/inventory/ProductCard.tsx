'use client'
import HoverImage from '@/components/ui/HoverImage'
import { normalizeCategory, vasyErpProductUrl } from '@/lib/utils'

interface ProductCardProps {
  item_code: string; product_name: string; category: string; brand: string
  image_url?: string; selling_price: number; landing_cost: number
  qty_sold: number; qty_remaining: number; revenue: number; profit: number
  vendor?: string; age_days?: number; product_id?: string
}

function fmt(v: number) { return v > 0 ? '₹' + Math.round(v).toLocaleString('en-IN') : '—' }
function pct(v: number) { return v > 0 ? v.toFixed(1) + '%' : '—' }

function ageBadge(days: number) {
  const d = Math.max(0, days)
  if (d <= 30)  return { label: `${d}d`, bg: '#d1fae5', color: '#065f46' }
  if (d <= 60)  return { label: `${d}d`, bg: '#fef3c7', color: '#92400e' }
  if (d <= 90)  return { label: `${d}d`, bg: '#fed7aa', color: '#9a3412' }
  return { label: `${d}d`, bg: '#fee2e2', color: '#991b1b' }
}

export default function ProductCard({ item_code, product_name, category, brand, image_url,
  selling_price, landing_cost, qty_sold, qty_remaining, revenue, profit, vendor, age_days, product_id }: ProductCardProps) {
  const margin = selling_price > 0 ? (selling_price - landing_cost) / selling_price * 100 : 0
  const age = age_days !== undefined ? ageBadge(age_days) : null
  const marginColor = margin >= 40 ? '#059669' : margin >= 25 ? '#d97706' : '#dc2626'
  const stockColor = qty_remaining <= 0 ? '#dc2626' : qty_remaining <= 3 ? '#d97706' : '#059669'
  const erpUrl = vasyErpProductUrl(product_id)
  const openErp = () => { if (erpUrl) window.open(erpUrl, '_blank', 'noopener,noreferrer') }

  return (
    <div className="product-card" style={{
      background: '#fff', borderRadius: 16, overflow: 'hidden',
      border: '1px solid #e8d5b7', display: 'flex', flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(59,7,100,0.07)'
    }}>
      {/* Image */}
      <div className="product-img-wrap" style={{ position: 'relative', aspectRatio: '1', background: '#f5f0e8' }}>
        <HoverImage src={image_url} alt={product_name} emoji="💍"
          style={{ width: '100%', height: '100%' }} wrapperStyle={{ width: '100%', height: '100%' }} previewSize={320} />
        {age && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20, background: age.bg, color: age.color }}>
            {age.label}
          </span>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20, background: '#3b0764', color: '#fff' }}>
          ×{qty_sold} sold
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div>
          <p style={{ fontSize: 10, color: '#6b5b7b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{normalizeCategory(category)}</p>
          <p onClick={openErp} title="Open in VasyERP" style={{ fontSize: 13, fontWeight: 600, color: erpUrl ? '#3b0764' : '#1a0a2e', margin: '2px 0 0', lineHeight: 1.3, cursor: erpUrl ? 'pointer' : 'default', textDecoration: erpUrl ? 'underline' : 'none', textDecorationColor: '#c4b5fd',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{product_name}</p>
          <p style={{ fontSize: 11, color: '#6b5b7b', margin: '2px 0 0' }}>{brand}</p>
        </div>

        {/* Prices */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[['Sold At', fmt(selling_price), '#7c3aed'], ['Cost', fmt(landing_cost), '#6b5b7b']].map(([l, v, c]) => (
            <div key={l} style={{ background: '#f5f0e8', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: '#6b5b7b', margin: 0 }}>{l}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: c as string, margin: '2px 0 0' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: '1px solid #e8d5b7' }}>
          {[
            ['Margin', pct(margin), marginColor],
            ['Revenue', fmt(revenue), '#1a0a2e'],
            ['Profit', fmt(profit), '#059669'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#6b5b7b' }}>{l}</span>
              <span style={{ fontWeight: 700, color: c as string }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div style={{ paddingTop: 6, borderTop: '1px solid #e8d5b7', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {vendor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: '#6b5b7b' }}>Vendor</span>
              <span style={{ color: '#1a0a2e', fontWeight: 500, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: '#6b5b7b' }}>Stock</span>
            <span style={{ fontWeight: 700, color: stockColor }}>{qty_remaining} left</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: '#6b5b7b' }}>Barcode</span>
            <span onClick={openErp} title="Open in VasyERP" style={{ fontFamily: 'monospace', color: erpUrl ? '#3b0764' : '#6b5b7b', cursor: erpUrl ? 'pointer' : 'default', textDecoration: erpUrl ? 'underline' : 'none', textDecorationColor: '#c4b5fd' }}>{item_code}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
