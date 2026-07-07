'use client'
import { useState } from 'react'
import HoverImage from '@/components/ui/HoverImage'
import ItemHistoryModal from '@/components/ui/ItemHistoryModal'
import OrderModal from '@/components/ui/OrderModal'
import TransferModal from './TransferModal'
import { History, ArrowLeftRight } from 'lucide-react'
import { normalizeCategory, vasyErpProductUrl, fmt_inr, fmt_num } from '@/lib/utils'

interface StockCardProps {
  item_code: string; product_name: string; category: string; brand: string
  vendor?: string; image_url?: string; qty: number; cost_per_unit: number
  stock_value: number; product_id?: string; _batches?: number
  sold_qty?: number; sold_revenue?: number; bucket?: string
}

export default function StockCard({ item_code, product_name, category, brand, vendor,
  image_url, qty, cost_per_unit, stock_value, product_id, _batches, sold_qty, sold_revenue, bucket }: StockCardProps) {
  const erpUrl = vasyErpProductUrl(product_id)
  const openErp = () => { if (erpUrl) window.open(erpUrl, '_blank', 'noopener,noreferrer') }
  const stockColor = qty <= 0 ? '#dc2626' : qty <= 3 ? '#d97706' : '#059669'
  const [showHistory, setShowHistory] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [orderVoucher, setOrderVoucher] = useState<string|null>(null)

  return (
    <div className="product-card" style={{
      background: '#fff', borderRadius: 16, overflow: 'hidden',
      border: '1px solid #e8d5b7', display: 'flex', flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(59,7,100,0.07)'
    }}>
      {/* Image — same fit approach as ProductCard: fixed square block,
          HoverImage's objectFit:cover fills it without distortion */}
      <div className="product-img-wrap" style={{ position: 'relative', aspectRatio: '1', background: '#f5f0e8', width: '100%' }}>
        <HoverImage src={image_url} alt={product_name} emoji="💍"
          style={{ width: '100%', height: '100%' }} wrapperStyle={{ width: '100%', height: '100%' }} previewSize={320} />
        {bucket && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20, background: '#f5f0e8', color: '#6b5b7b' }}>
            {bucket}
          </span>
        )}
        {_batches !== undefined && _batches > 1 && (
          <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20, background: '#3b0764', color: '#fff' }}>
            {_batches} batches
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div>
          <p style={{ fontSize: 10, color: '#6b5b7b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{normalizeCategory(category)}</p>
          <p onClick={openErp} title="Open in VasyERP" style={{ fontSize: 13, fontWeight: 600, color: erpUrl ? '#3b0764' : '#1a0a2e', margin: '2px 0 0', lineHeight: 1.3, cursor: erpUrl ? 'pointer' : 'default', textDecoration: erpUrl ? 'underline' : 'none', textDecorationColor: '#c4b5fd',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{product_name}</p>
          <p style={{ fontSize: 11, color: '#6b5b7b', margin: '2px 0 0' }}>{brand}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: '#f5f0e8', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
            <p style={{ fontSize: 9, color: '#6b5b7b', margin: 0 }}>Cost/Unit</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b5b7b', margin: '2px 0 0' }}>{cost_per_unit > 0 ? fmt_inr(cost_per_unit) : '—'}</p>
          </div>
          <div style={{ background: '#f5f0e8', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
            <p style={{ fontSize: 9, color: '#6b5b7b', margin: 0 }}>Stock Value</p>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1a0a2e', margin: '2px 0 0' }}>{stock_value > 0 ? fmt_inr(stock_value) : '—'}</p>
          </div>
        </div>

        {(sold_qty !== undefined) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: '1px solid #e8d5b7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#6b5b7b' }}>Sold (lifetime)</span>
              <span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmt_num(sold_qty)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: '#6b5b7b' }}>Revenue (lifetime)</span>
              <span style={{ fontWeight: 700, color: '#059669' }}>{fmt_inr(sold_revenue||0)}</span>
            </div>
          </div>
        )}

        <div style={{ paddingTop: 6, borderTop: '1px solid #e8d5b7', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {vendor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: '#6b5b7b' }}>Vendor</span>
              <span style={{ color: '#1a0a2e', fontWeight: 500, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: '#6b5b7b' }}>Stock</span>
            <span style={{ fontWeight: 700, color: stockColor }}>{qty} left</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: '#6b5b7b' }}>Barcode</span>
            <span onClick={openErp} style={{ fontFamily: 'monospace', color: erpUrl ? '#3b0764' : '#6b5b7b', cursor: erpUrl ? 'pointer' : 'default', textDecoration: erpUrl ? 'underline' : 'none', textDecorationColor: '#c4b5fd' }}>{item_code}</span>
          </div>
        </div>

        <div style={{ display:'flex', gap:6, marginTop: 2 }}>
          <button onClick={()=>setShowHistory(true)} style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            padding:'6px', borderRadius:8, border:'1px solid #e8d5b7', background:'#faf8f4',
            fontSize:11, fontWeight:600, color:'#3b0764', cursor:'pointer',
          }}>
            <History size={12}/> History
          </button>
          <button onClick={()=>setShowTransfer(true)} disabled={qty<=0} title={qty>0?'Transfer to another branch':'No stock to transfer'} style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            padding:'6px 10px', borderRadius:8, border:'1px solid #e8d5b7', background:'#faf8f4',
            fontSize:11, fontWeight:600, color:'#3b0764', cursor: qty>0?'pointer':'default',
            opacity: qty>0?1:0.45,
          }}>
            <ArrowLeftRight size={12}/> Transfer
          </button>
        </div>
      </div>

      {showHistory && (
        <ItemHistoryModal itemCode={item_code} productName={product_name} onClose={()=>setShowHistory(false)} onOpenOrder={(v)=>{setShowHistory(false);setOrderVoucher(v)}}/>
      )}
      {orderVoucher && <OrderModal voucherNo={orderVoucher} onClose={()=>setOrderVoucher(null)}/>}
      {showTransfer && (
        <TransferModal itemCode={item_code} productName={product_name} category={category} brand={brand} currentQty={qty} onClose={()=>setShowTransfer(false)}/>
      )}
    </div>
  )
}
