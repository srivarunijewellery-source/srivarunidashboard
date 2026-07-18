'use client'
import { useState, useEffect } from 'react'
import { fetchAllRows } from '@/lib/supabase'
import { fmt_inr, fmt_num, parseDate } from '@/lib/utils'
import { useSortable } from '@/lib/useSortable'
import SortIndicator from './SortIndicator'
import { format } from 'date-fns'
import { X } from 'lucide-react'

// sales_unified = FTP-sourced sales for every date it covers, backfilled with
// API-sourced sales_api for anything after FTP's last successful sync. See
// the view's SQL comment for the full explanation.
const SALES_SOURCE = 'sales_unified'

export default function BillsListModal({ from, to, label, branchId, onClose, onOpenOrder }: {
  from: string; to: string; label: string; branchId?: string | null; onClose: () => void; onOpenOrder: (voucherNo: string) => void
}) {
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchAllRows(SALES_SOURCE, 'voucher_no,date,customer_name,mobile_no,qty,net_amount', q => {
      let qq = q.gte('date', from).lte('date', to)
      if (branchId) qq = qq.eq('branch_id', branchId)
      return qq
    })
      .then(data => {
        if (!active) return
        const map: Record<string, any> = {}
        for (const r of data) {
          const v = r.voucher_no
          if (!map[v]) map[v] = { voucher_no: v, date: r.date, customer_name: r.customer_name || 'Walk-in', mobile_no: r.mobile_no, items: 0, amount: 0 }
          map[v].items += r.qty || 0
          map[v].amount += r.net_amount || 0
        }
        setBills(Object.values(map).sort((a: any, b: any) => parseDate(b.date).getTime() - parseDate(a.date).getTime()))
        setLoading(false)
      })
    return () => { active = false }
  }, [from, to, branchId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const billsGetValue = (b:any, key:string) => b[key]
  const { sorted: sortedBills, sortKey, sortDir, toggleSort } = useSortable(bills, billsGetValue)
  const totalAmount = bills.reduce((s, b) => s + b.amount, 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,46,0.55)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: '#3b0764', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h3 className="font-display" style={{ color: '#fff', margin: 0, fontSize: 17 }}>Bills — {label}</h3>
            <p style={{ color: '#c4b5fd', fontSize: 12, margin: '4px 0 0' }}>{bills.length} bills · {fmt_inr(totalAmount)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ overflow: 'auto' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Loading…</div> : bills.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>No bills in this period.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{[['Date','date'],['Bill No','voucher_no'],['Customer','customer_name'],['Phone','mobile_no'],['Items','items'],['Amount','amount']].map(([h,key]) =>
                <th key={h} onClick={()=>toggleSort(key)} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase', letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', textAlign: (h === 'Items' || h === 'Amount') ? 'right' : 'left', position: 'sticky', top: 0, cursor:'pointer' }}>{h}<SortIndicator active={sortKey===key} dir={sortDir}/></th>)}
              </tr></thead>
              <tbody>
                {sortedBills.map((b, i) => (
                  <tr key={b.voucher_no} style={{ background: i % 2 === 0 ? '#fff' : '#faf8ff' }}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8' }}>{format(parseDate(b.date), 'dd MMM yyyy')}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8' }}>
                      <button onClick={() => onOpenOrder(b.voucher_no)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: '#7c3aed', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#c4b5fd' }}>{b.voucher_no}</button>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', fontWeight: 600 }}>{b.customer_name}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', color: '#6b5b7b', fontFamily: 'monospace', fontSize: 11 }}>{b.mobile_no || '—'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', textAlign: 'right' }}>{fmt_num(b.items)}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', textAlign: 'right', fontWeight: 700 }}>{fmt_inr(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
