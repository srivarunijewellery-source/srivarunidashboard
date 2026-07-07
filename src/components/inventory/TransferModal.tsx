'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ArrowRight } from 'lucide-react'

type Branch = { id: string; code: string; name: string; is_test: boolean; erp_branch_id: string | null }

interface TransferModalProps {
  itemCode: string
  productName?: string
  category?: string
  brand?: string
  batchNo?: string | null
  currentQty: number
  onClose: () => void
  onCreated?: () => void
}

/**
 * Creates a PENDING stock transfer request only. Nothing here ever
 * touches computed_inventory or any ERP-derived table -- actual stock
 * only moves when the team executes the transfer in VasyERP and the
 * next sync reflects it. This modal is intentionally a one-way write
 * into stock_transfer_requests, an intent-only ledger.
 */
export default function TransferModal({ itemCode, productName, category, brand, batchNo, currentQty, onClose, onCreated }: TransferModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch] = useState('')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.from('branches').select('id,code,name,is_test,erp_branch_id').eq('is_active', true).order('is_test', { ascending: true }).then(({ data }) => {
      if (!active) return
      const list = (data || []) as Branch[]
      setBranches(list)
      // Default From = the branch actually linked to VasyERP (where real
      // stock lives today); default To = the first other branch (Test).
      const real = list.find(b => b.erp_branch_id)
      const other = list.find(b => b.id !== real?.id)
      setFromBranch(real?.id || list[0]?.id || '')
      setToBranch(other?.id || list[1]?.id || '')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const canSubmit = !!fromBranch && !!toBranch && fromBranch !== toBranch && qty > 0 && qty <= currentQty && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true); setError(null)
    const { error: insertError } = await supabase.from('stock_transfer_requests').insert({
      item_code: itemCode,
      batch_no: batchNo || null,
      item_name: productName || null,
      category: category || null,
      brand: brand || null,
      from_branch_id: fromBranch,
      to_branch_id: toBranch,
      requested_qty: qty,
      notes: notes || null,
      status: 'pending',
    })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setDone(true)
    onCreated?.()
    setTimeout(onClose, 900)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(26,10,46,0.55)', zIndex:170, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, maxWidth:420, width:'100%', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ background:'#3b0764', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 className="font-display" style={{ color:'#fff', margin:0, fontSize:16 }}>Transfer Stock</h3>
            <p style={{ color:'#c4b5fd', fontSize:11, margin:'2px 0 0' }}>{productName || itemCode} · {itemCode}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', padding:4, display:'flex' }}><X size={18}/></button>
        </div>

        {loading ? (
          <div style={{ padding:32, textAlign:'center', color:'#6b5b7b', fontSize:13 }}>Loading branches…</div>
        ) : done ? (
          <div style={{ padding:32, textAlign:'center', color:'#059669', fontSize:14, fontWeight:600 }}>Request created — it&apos;s now pending.</div>
        ) : branches.length < 2 ? (
          <div style={{ padding:20, fontSize:13, color:'#6b5b7b' }}>You need at least two branches to create a transfer. Add one on the Stock Transfer page.</div>
        ) : (
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ fontSize:12, color:'#6b5b7b' }}>
              This creates a <strong style={{ color:'#3b0764' }}>pending request</strong> only — actual stock does not move until your team executes the transfer in the ERP.
            </div>

            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'#8b7d97', textTransform:'uppercase', letterSpacing:0.5 }}>From</label>
                <select value={fromBranch} onChange={e=>setFromBranch(e.target.value)} style={{ width:'100%', marginTop:4, padding:'8px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e' }}>
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}{b.is_test?' (test)':''}</option>)}
                </select>
              </div>
              <ArrowRight size={16} color="#8b7d97" style={{ marginTop:26 }}/>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'#8b7d97', textTransform:'uppercase', letterSpacing:0.5 }}>To</label>
                <select value={toBranch} onChange={e=>setToBranch(e.target.value)} style={{ width:'100%', marginTop:4, padding:'8px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e' }}>
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}{b.is_test?' (test)':''}</option>)}
                </select>
              </div>
            </div>
            {fromBranch === toBranch && <p style={{ fontSize:11, color:'#dc2626', margin:0 }}>From and To must be different branches.</p>}

            <div>
              <label style={{ fontSize:10, fontWeight:700, color:'#8b7d97', textTransform:'uppercase', letterSpacing:0.5 }}>Quantity <span style={{ fontWeight:400, textTransform:'none' }}>({currentQty} available)</span></label>
              <input type="number" min={1} max={currentQty} value={qty} onChange={e=>setQty(Math.max(1, Math.min(currentQty, Number(e.target.value)||1)))}
                style={{ width:'100%', marginTop:4, padding:'8px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e' }}/>
              {qty > currentQty && <p style={{ fontSize:11, color:'#dc2626', margin:'4px 0 0' }}>Only {currentQty} in stock.</p>}
            </div>

            <div>
              <label style={{ fontSize:10, fontWeight:700, color:'#8b7d97', textTransform:'uppercase', letterSpacing:0.5 }}>Notes (optional)</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
                style={{ width:'100%', marginTop:4, padding:'8px 10px', borderRadius:8, border:'1px solid #e8d5b7', fontSize:13, color:'#1a0a2e', resize:'vertical', fontFamily:'inherit' }}/>
            </div>

            {error && <p style={{ fontSize:12, color:'#dc2626', margin:0 }}>{error}</p>}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
              <button onClick={onClose} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', color:'#6b5b7b', fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={!canSubmit} style={{ padding:'8px 16px', borderRadius:8, border:'none', background: canSubmit?'#3b0764':'#d8cfe0', color:'#fff', fontSize:13, fontWeight:600, cursor: canSubmit?'pointer':'default' }}>
                {saving?'Creating…':'Create Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
