'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAllRows } from '@/lib/supabase'
import { fmt_inr } from '@/lib/utils'
import { X } from 'lucide-react'

export default function CustomersListModal({ from, to, label, onClose }: {
  from: string; to: string; label: string; onClose: () => void
}) {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchAllRows('sales', 'voucher_no,customer_name,mobile_no,net_amount', q => q.gte('date', from).lte('date', to))
      .then(data => {
        if (!active) return
        const map: Record<string, any> = {}
        for (const r of data) {
          const key = r.mobile_no || r.customer_name || 'unknown'
          if (!map[key]) map[key] = { name: r.customer_name || 'Walk-in', mobile: r.mobile_no, visits: new Set<string>(), spend: 0 }
          map[key].visits.add(r.voucher_no)
          map[key].spend += r.net_amount || 0
        }
        const list = Object.values(map).map((c: any) => ({ ...c, visits: c.visits.size })).sort((a: any, b: any) => b.spend - a.spend)
        setCustomers(list)
        setLoading(false)
      })
    return () => { active = false }
  }, [from, to])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const goToCustomer = (name: string, mobile?: string) => {
    router.push(`/customers?name=${encodeURIComponent(name)}&mobile=${encodeURIComponent(mobile || '')}`)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,10,46,0.55)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background: '#3b0764', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h3 className="font-display" style={{ color: '#fff', margin: 0, fontSize: 17 }}>Customers — {label}</h3>
            <p style={{ color: '#c4b5fd', fontSize: 12, margin: '4px 0 0' }}>{customers.length} customers visited · click a name for their full history</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ overflow: 'auto' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>Loading…</div> : customers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b5b7b' }}>No customers in this period.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Customer', 'Phone', 'Visits', 'Spend'].map(h =>
                <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#6b5b7b', textTransform: 'uppercase', letterSpacing: 0.5, background: '#f5f0e8', borderBottom: '1px solid #e8d5b7', textAlign: (h === 'Visits' || h === 'Spend') ? 'right' : 'left', position: 'sticky', top: 0 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={(c.mobile || c.name) + i} style={{ background: i % 2 === 0 ? '#fff' : '#faf8ff' }}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8' }}>
                      <button onClick={() => goToCustomer(c.name, c.mobile)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: '#3b0764', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#c4b5fd' }}>{c.name}</button>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', color: '#6b5b7b', fontFamily: 'monospace', fontSize: 11 }}>{c.mobile || '—'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', textAlign: 'right' }}>{c.visits}×</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0e8d8', textAlign: 'right', fontWeight: 700 }}>{fmt_inr(c.spend)}</td>
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
