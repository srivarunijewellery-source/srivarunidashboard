'use client'
import Image from 'next/image'
import { useState } from 'react'
import { cn, fmt_inr, fmt_pct, getAgeBadge } from '@/lib/utils'

interface ProductCardProps {
  item_code: string
  product_name: string
  category: string
  brand: string
  image_url?: string
  mrp: number
  selling_price: number
  landing_cost: number
  qty_sold: number
  qty_remaining: number
  revenue: number
  profit: number
  vendor?: string
  age_days?: number
  batch_no?: string
}

export default function ProductCard({
  item_code, product_name, category, brand, image_url,
  mrp, selling_price, landing_cost, qty_sold, qty_remaining,
  revenue, profit, vendor, age_days, batch_no
}: ProductCardProps) {
  const [imgErr, setImgErr] = useState(false)
  const margin = selling_price > 0 ? ((selling_price - landing_cost) / selling_price * 100) : 0
  const age = age_days !== undefined ? getAgeBadge(age_days) : null

  return (
    <div className="product-card bg-white rounded-2xl overflow-hidden shadow-card border border-sv-beige-dark flex flex-col">

      {/* Image */}
      <div className="product-img-wrap relative bg-sv-beige-mid aspect-square">
        {image_url && !imgErr ? (
          <Image
            src={image_url}
            alt={product_name}
            fill
            className="object-cover"
            onError={() => setImgErr(true)}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">💍</span>
          </div>
        )}

        {/* Age badge */}
        {age && (
          <span className={cn('absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full', age.color)}>
            {age.label}
          </span>
        )}

        {/* Qty sold badge */}
        <span className="absolute top-2 left-2 bg-sv-purple text-white text-xs font-bold px-2 py-0.5 rounded-full">
          ×{qty_sold} sold
        </span>
      </div>

      {/* Details */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Name + category */}
        <div>
          <p className="text-xs text-sv-muted font-medium uppercase tracking-wide">{category}</p>
          <p className="text-sm font-semibold text-sv-ink leading-snug line-clamp-2">{product_name}</p>
          <p className="text-xs text-sv-muted mt-0.5">{brand}</p>
        </div>

        {/* Price row */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-sv-beige rounded-lg py-1.5 px-1">
            <p className="text-xs text-sv-muted leading-none mb-0.5">MRP</p>
            <p className="text-xs font-semibold text-sv-ink">{fmt_inr(mrp)}</p>
          </div>
          <div className="bg-sv-beige rounded-lg py-1.5 px-1">
            <p className="text-xs text-sv-muted leading-none mb-0.5">Sold</p>
            <p className="text-xs font-semibold text-sv-purple-light">{fmt_inr(selling_price)}</p>
          </div>
          <div className="bg-sv-beige rounded-lg py-1.5 px-1">
            <p className="text-xs text-sv-muted leading-none mb-0.5">Cost</p>
            <p className="text-xs font-semibold text-sv-ink">{fmt_inr(landing_cost)}</p>
          </div>
        </div>

        {/* Margin + Revenue */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-sv-beige-dark">
          <span className="text-sv-muted">Margin</span>
          <span className={cn('font-bold', margin >= 40 ? 'text-emerald-600' : margin >= 25 ? 'text-amber-600' : 'text-red-500')}>
            {fmt_pct(margin)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-sv-muted">Revenue</span>
          <span className="font-semibold text-sv-ink">{fmt_inr(revenue)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-sv-muted">Profit</span>
          <span className="font-semibold text-emerald-600">{fmt_inr(profit)}</span>
        </div>

        {/* Meta */}
        <div className="pt-1 border-t border-sv-beige-dark space-y-0.5">
          {vendor && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-sv-muted">Vendor</span>
              <span className="font-medium text-sv-ink truncate max-w-[120px]">{vendor}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-sv-muted">Stock</span>
            <span className={cn('font-medium', qty_remaining <= 0 ? 'text-red-500' : qty_remaining <= 3 ? 'text-amber-600' : 'text-emerald-600')}>
              {qty_remaining} left
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-sv-muted">Barcode</span>
            <span className="font-mono text-sv-muted text-xs">{item_code}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
