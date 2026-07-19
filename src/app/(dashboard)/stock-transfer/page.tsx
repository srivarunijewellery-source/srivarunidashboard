'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { fmt_num, normalizeCategory } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import MetricCard from '@/components/ui/MetricCard'
import { ArrowRight, Download, Trash2, RefreshCw, CheckCircle2, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'9px 12px', fontSize:10, fontWeight:700, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.6, background:'#f5f0e8', borderBottom:'2px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'8px 12px', fontSize:12.5, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8', whiteSpace:'nowrap' as const },
}

type Branch = { id:string; code:string; name:string; is_test:boolean; erp_branch_id:string|null }
type TransferRequest = {
  id:string; item_code:string; batch_no:string|null; item_name:string|null; category:string|null; brand:string|null
  from_branch_id:string; to_branch_id:string; requested_qty:number; status:'pending'|'exported'|'closed'|'cancelled'
  notes:string|null; created_at:string; exported_at:string|null; closed_at:string|null; export_batch_id:string|null
}

const STATUS_TABS = ['pending','exported','closed','all'] as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, {bg:string;fg:string;label:string}> = {
    pending: { bg:'#fef3c7', fg:'#92400e', label:'Pending' },
    exported: { bg:'#dbeafe', fg:'#1e40af', label:'Exported' },
    closed: { bg:'#dcfce7', fg:'#166534', label:'Closed' },
    cancelled: { bg:'#f3f4f6', fg:'#6b7280', label:'Cancelled' },
  }
  const c = map[status] || map.pending
  return <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:c.bg, color:c.fg }}>{c.label}</span>
}

/**
 * Stock Transfer page. Everything here operates on stock_transfer_requests
 * only -- an intent-only ledger. Nothing on this page writes to
 * computed_inventory, products, or any ERP-sourced table; actual stock
 * only ever moves when the team executes a transfer in VasyERP itself and
 * the next sync reflects it.
 */
export default function StockTransferPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('pending')
  const [pivotFilter, setPivotFilter] = useState<{cat:string;brand:string}|null>(null)
  const [busyId, setBusyId] = useState<string|null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null)

  const branchMap = useMemo(() => Object.fromEntries(branches.map(b=>[b.id,b])), [branches])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: br }, reqs] = await Promise.all([
        supabase.from('branches').select('id,code,name,is_test,erp_branch_id').order('is_test', { ascending: true }),
        fetchAllRows<TransferRequest>('stock_transfer_requests', '*', q=>q, 'created_at'),
      ])
      setBranches((br||[]) as Branch[])
      const sortedReqs = [...reqs].sort((a,b)=> b.created_at.localeCompare(a.created_at))
      setRequests(sortedReqs)
      const codes = [...new Set(sortedReqs.map(r=>r.item_code))]
      if (codes.length) {
        const { data: inv } = await supabase.from('computed_inventory').select('item_code,qty').in('item_code', codes)
        const map: Record<string, number> = {}
        for (const row of (inv||[])) map[row.item_code] = (map[row.item_code]||0) + (row.qty||0)
        setQtyMap(map)
      } else setQtyMap({})
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Real, on-hand qty at a given branch right now. Only the branch actually
  // linked to VasyERP carries real quantity today (VasyERP is single-
  // branch) -- any other branch (like the Test branch) has nothing until
  // stock is physically moved there and the ERP reflects it.
  const availableAt = useCallback((branchId: string, itemCode: string) => {
    const b = branchMap[branchId]
    if (!b?.erp_branch_id) return 0
    return qtyMap[itemCode] ?? 0
  }, [branchMap, qtyMap])

  const filteredByTab = useMemo(() => tab==='all' ? requests : requests.filter(r=>r.status===tab), [requests, tab])
  const filtered = useMemo(() => {
    if (!pivotFilter) return filteredByTab
    return filteredByTab.filter(r => {
      if (pivotFilter.cat!=='ALL' && normalizeCategory(r.category||'')!==pivotFilter.cat) return false
      if (pivotFilter.brand!=='ALL' && (r.brand||'Unknown')!==pivotFilter.brand) return false
      return true
    })
  }, [filteredByTab, pivotFilter])

  const pivotRows = useMemo(() => {
    const map: Record<string, any> = {}
    const brandTotals: Record<string, number> = {}
    for (const r of filteredByTab) {
      const cat = normalizeCategory(r.category||''), br = r.brand || 'Unknown'
      brandTotals[br] = (brandTotals[br]||0) + r.requested_qty
      if (!map[cat]) map[cat] = { category:cat, total:0, brands:{} as Record<string,number> }
      map[cat].total += r.requested_qty
      map[cat].brands[br] = (map[cat].brands[br]||0) + r.requested_qty
    }
    return { rows: Object.values(map).sort((a:any,b:any)=>b.total-a.total), brands: Object.keys(brandTotals).sort((a,b)=>brandTotals[b]-brandTotals[a]) }
  }, [filteredByTab])

  const summary = useMemo(() => ({
    pendingCount: requests.filter(r=>r.status==='pending').length,
    pendingQty: requests.filter(r=>r.status==='pending').reduce((s,r)=>s+r.requested_qty,0),
    exportedCount: requests.filter(r=>r.status==='exported').length,
    closedCount: requests.filter(r=>r.status==='closed').length,
  }), [requests])

  const doDelete = async (id: string) => {
    setBusyId(id)
    await supabase.from('stock_transfer_requests').delete().eq('id', id)
    setRequests(rs => rs.filter(r=>r.id!==id))
    setBusyId(null); setConfirmDeleteId(null)
  }

  const doClose = async (id: string) => {
    setBusyId(id)
    const closed_at = new Date().toISOString()
    await supabase.from('stock_transfer_requests').update({ status:'closed', closed_at }).eq('id', id)
    setRequests(rs => rs.map(r=>r.id===id?{...r, status:'closed' as const, closed_at}:r))
    setBusyId(null)
  }

  const doReconcile = async (r: TransferRequest) => {
    setBusyId(r.id)
    const avail = availableAt(r.from_branch_id, r.item_code)
    const newQty = Math.max(0, Math.min(r.requested_qty, avail))
    await supabase.from('stock_transfer_requests').update({ requested_qty: newQty }).eq('id', r.id)
    setRequests(rs => rs.map(x=>x.id===r.id?{...x, requested_qty:newQty}:x))
    setBusyId(null)
  }

  const exportPending = () => {
    const pending = requests.filter(r=>r.status==='pending')
    if (pending.length===0) return
    const batchId = crypto.randomUUID()
    const rows = pending.map(r => ({
      'Item Code': r.item_code,
      'Batch': r.batch_no || '',
      'Product Name': r.item_name || '',
      'Category': r.category || '',
      'Brand': r.brand || '',
      'From Branch': branchMap[r.from_branch_id]?.name || '',
      'To Branch': branchMap[r.to_branch_id]?.name || '',
      'Requested Qty': r.requested_qty,
      'Available Now': availableAt(r.from_branch_id, r.item_code),
      'Notes': r.notes || '',
      'Created': new Date(r.created_at).toLocaleDateString('en-IN'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{wch:14},{wch:10},{wch:32},{wch:16},{wch:16},{wch:18},{wch:18},{wch:14},{wch:13},{wch:24},{wch:12}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Transfers')
    const dateStr = new Date().toISOString().slice(0,10)
    XLSX.writeFile(wb, `stock-transfer-requests-${dateStr}.xlsx`)

    const exported_at = new Date().toISOString()
    const ids = pending.map(r=>r.id)
    supabase.from('stock_transfer_requests').update({ status:'exported', exported_at, export_batch_id: batchId }).in('id', ids).then(() => {
      setRequests(rs => rs.map(r => ids.includes(r.id) ? { ...r, status:'exported' as const, exported_at, export_batch_id: batchId } : r))
    })
  }

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Stock Transfer" subtitle="Requests logged here stay pending until your team executes the move in the ERP — nothing here changes actual stock"
        actions={
          <button onClick={exportPending} disabled={summary.pendingCount===0} style={{
            display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:10, border:'none',
            background: summary.pendingCount>0?'#3b0764':'#d8cfe0', color:'#fff', fontSize:13, fontWeight:600,
            cursor: summary.pendingCount>0?'pointer':'default',
          }}>
            <Download size={14}/> Export Pending to Excel {summary.pendingCount>0 && `(${summary.pendingCount})`}
          </button>
        }
      />
      <div className="page-content" style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:22 }}>

        <div className="responsive-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          <MetricCard label="Pending Requests" value={fmt_num(summary.pendingCount)} accent="amber"/>
          <MetricCard label="Pending Units" value={fmt_num(summary.pendingQty)} accent="amber"/>
          <MetricCard label="Exported (awaiting execution)" value={fmt_num(summary.exportedCount)} accent="purple"/>
          <MetricCard label="Closed" value={fmt_num(summary.closedCount)} accent="green"/>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {STATUS_TABS.map(t=>(
            <button key={t} onClick={()=>{setTab(t);setPivotFilter(null)}} style={{
              padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer',
              border:`1px solid ${tab===t?'#3b0764':'#e8d5b7'}`, background:tab===t?'#3b0764':'#fff', color:tab===t?'#fff':'#6b5b7b',
              textTransform:'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>
        ) : (
          <>
          {pivotRows.rows.length>0 && (
            <div style={S.section}>
              <div style={{ padding:'12px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h3 className="font-display" style={{ fontSize:14, color:'#3b0764', margin:0, textTransform:'capitalize' }}>Category × Brand — {tab} requests</h3>
                {pivotFilter && <button onClick={()=>setPivotFilter(null)} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:11, cursor:'pointer', color:'#6b5b7b' }}>Clear filter ×</button>}
              </div>
              <div className="table-scroll" style={{ overflow:'auto', maxHeight:300 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr>
                    <th style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, top:0, minWidth:140 }}>Category</th>
                    <th style={{ ...S.th, textAlign:'right' }}>Total Units</th>
                    {pivotRows.brands.map(b=><th key={b} style={{ ...S.th, textAlign:'right' }}>{b}</th>)}
                  </tr></thead>
                  <tbody>
                    {pivotRows.rows.map((row:any, ri:number)=>(
                      <tr key={row.category} style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                        <td onClick={()=>setPivotFilter({cat:row.category,brand:'ALL'})} style={{ ...S.td, fontWeight:700, color:'#3b0764', cursor:'pointer', position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff' }}>{row.category}</td>
                        <td onClick={()=>setPivotFilter({cat:row.category,brand:'ALL'})} style={{ ...S.td, textAlign:'right', fontWeight:700, cursor:'pointer' }}>{fmt_num(row.total)}</td>
                        {pivotRows.brands.map(b=>(
                          <td key={b} onClick={()=>row.brands[b]&&setPivotFilter({cat:row.category,brand:b})} style={{ ...S.td, textAlign:'right', cursor:row.brands[b]?'pointer':'default', color:row.brands[b]?'#1a0a2e':'#d8cfe0' }}>{row.brands[b]?fmt_num(row.brands[b]):'—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={S.section}>
            {filtered.length===0 ? (
              <div style={{ padding:32, textAlign:'center', color:'#6b5b7b', fontSize:13 }}>No {tab==='all'?'':tab} requests.</div>
            ) : (
              <div className="table-scroll" style={{ overflow:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr>
                    {['Item','Category','Brand','From → To','Requested','Available Now','Status','Created',''].map(h=>
                      <th key={h} style={{ ...S.th, textAlign: (h==='Requested'||h==='Available Now')?'right':'left' }}>{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {filtered.map((r,i)=>{
                      const avail = availableAt(r.from_branch_id, r.item_code)
                      const short = r.status==='pending' && avail < r.requested_qty
                      return (
                        <tr key={r.id} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                          <td style={S.td}>
                            <div style={{ fontWeight:600, color:'#1a0a2e' }}>{r.item_name || r.item_code}</div>
                            <div style={{ fontSize:10, color:'#6b5b7b', fontFamily:'monospace' }}>{r.item_code}{r.batch_no?` · ${r.batch_no}`:''}</div>
                          </td>
                          <td style={S.td}>{r.category?normalizeCategory(r.category):'—'}</td>
                          <td style={S.td}>{r.brand||'—'}</td>
                          <td style={S.td}>{branchMap[r.from_branch_id]?.name||'—'} <ArrowRight size={10} style={{display:'inline',verticalAlign:'middle',margin:'0 3px'}}/> {branchMap[r.to_branch_id]?.name||'—'}</td>
                          <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{fmt_num(r.requested_qty)}</td>
                          <td style={{ ...S.td, textAlign:'right', color: short?'#dc2626':'#059669', fontWeight:600 }}>{fmt_num(avail)}{short && ' ⚠'}</td>
                          <td style={S.td}><StatusBadge status={r.status}/></td>
                          <td style={{ ...S.td, color:'#6b5b7b', fontSize:11 }}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                              {r.status!=='closed' && (
                                <button onClick={()=>doReconcile(r)} disabled={busyId===r.id} title="Snap to actual available qty" style={{ padding:5, borderRadius:6, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', display:'flex', color:'#3b0764' }}>
                                  <RefreshCw size={12}/>
                                </button>
                              )}
                              {r.status!=='closed' && (
                                <button onClick={()=>doClose(r.id)} disabled={busyId===r.id} title="Mark closed" style={{ padding:5, borderRadius:6, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', display:'flex', color:'#059669' }}>
                                  <CheckCircle2 size={12}/>
                                </button>
                              )}
                              {confirmDeleteId===r.id ? (
                                <>
                                  <button onClick={()=>doDelete(r.id)} disabled={busyId===r.id} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #dc2626', background:'#fee2e2', color:'#991b1b', fontSize:10, fontWeight:700, cursor:'pointer' }}>Confirm</button>
                                  <button onClick={()=>setConfirmDeleteId(null)} style={{ padding:5, borderRadius:6, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', display:'flex', color:'#6b5b7b' }}><X size={12}/></button>
                                </>
                              ) : (
                                <button onClick={()=>setConfirmDeleteId(r.id)} disabled={busyId===r.id} title="Delete request" style={{ padding:5, borderRadius:6, border:'1px solid #e8d5b7', background:'#fff', cursor:'pointer', display:'flex', color:'#dc2626' }}>
                                  <Trash2 size={12}/>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  )
}
