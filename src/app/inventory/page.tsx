'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fmt_inr, fmt_num } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import HoverImage from '@/components/ui/HoverImage'
import ProductModal from '@/components/ui/ProductModal'

const S = {
  section: { background:'#fff', borderRadius:16, border:'1px solid #e8d5b7', boxShadow:'0 2px 8px rgba(59,7,100,0.07)', overflow:'hidden' },
  th: { padding:'10px 14px', fontSize:11, fontWeight:600, color:'#6b5b7b', textTransform:'uppercase' as const, letterSpacing:0.5, background:'#f5f0e8', borderBottom:'1px solid #e8d5b7', whiteSpace:'nowrap' as const },
  td: { padding:'10px 12px', fontSize:12, color:'#1a0a2e', borderBottom:'1px solid #f0e8d8' },
}

export default function InventoryPage() {
  const [pivotRows, setPivotRows] = useState<any[]>([])
  const [allBrands, setAllBrands] = useState<string[]>([])
  const [drillKey, setDrillKey] = useState<{cat:string;brand:string}|null>(null)
  const [drillItems, setDrillItems] = useState<any[]>([])
  const [snapLoading, setSnapLoading] = useState(false)
  const [productItemCode, setProductItemCode] = useState<string|null>(null)

  const loadSnapshot = useCallback(async () => {
    setSnapLoading(true)
    try {
      const { data } = await supabase.from('inventory_with_cost')
        .select('item_code,category,brand,qty,mrp,cost_per_unit,stock_value').gt('qty',0).limit(10000)
      if (!data) return
      const brands = [...new Set(data.map(p=>p.brand).filter(Boolean))].sort()
      setAllBrands(brands)
      const map: Record<string,any> = {}
      for (const p of data) {
        const cat = p.category||'Other', br = p.brand||'Unknown'
        const val = p.stock_value || (p.cost_per_unit||0)*(p.qty||0)
        if (!map[cat]) map[cat] = { category:cat, total:{qty:0,value:0}, brands:{} }
        map[cat].total.qty += p.qty||0
        map[cat].total.value += val
        if (!map[cat].brands[br]) map[cat].brands[br] = { qty:0, value:0 }
        map[cat].brands[br].qty += p.qty||0
        map[cat].brands[br].value += val
      }
      setPivotRows(Object.values(map).sort((a,b)=>b.total.qty-a.total.qty))
    } finally { setSnapLoading(false) }
  }, [])

  const loadDrill = useCallback(async (cat:string, brand:string) => {
    setDrillKey({cat,brand})
    let q = supabase.from('inventory_with_cost').select('*').gt('qty',0)
    if (cat!=='ALL') q = q.eq('category',cat)
    if (brand!=='ALL') q = q.eq('brand',brand)
    const { data } = await q.order('qty',{ascending:false}).limit(1000)
    setDrillItems(data||[])
  }, [])

  useEffect(() => { loadSnapshot() }, [loadSnapshot])

  return (
    <div style={{ minHeight:'100%', background:'#f5f0e8' }}>
      <PageHeader title="Inventory" subtitle="Live stock snapshot by category and brand" />
      <div style={{ padding:'0 32px 32px', display:'flex', flexDirection:'column', gap:20 }}>

        <div>
          <h2 className="font-display" style={{ fontSize:18, color:'#3b0764', margin:0 }}>Stock Snapshot — Category × Brand</h2>
          <p style={{ fontSize:12, color:'#6b5b7b', marginTop:4 }}>Click any cell for product detail · Stock value from purchase rates · Sold items are on the Sales → Details page</p>
        </div>

        {snapLoading?<div style={{ height:200, background:'#fff', borderRadius:16, border:'1px solid #e8d5b7' }}/>:(
          <div style={S.section}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#3b0764' }}>
                    <th style={{ ...S.th, background:'#3b0764', color:'#fff', position:'sticky', left:0, minWidth:160 }}>Category</th>
                    <th style={{ ...S.th, background:'#4c1d95', color:'#fff', textAlign:'right', cursor:'pointer' }} onClick={()=>loadDrill('ALL','ALL')}>TOTAL</th>
                    {allBrands.map(b=><th key={b} style={{ ...S.th, background:'#3b0764', color:'#fff', textAlign:'right', minWidth:100 }}>{b}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row,ri)=>(
                    <tr key={row.category} style={{ background:ri%2===0?'#fff':'#faf8ff' }}>
                      <td style={{ ...S.td, color:'#3b0764', fontWeight:700, position:'sticky', left:0, background:ri%2===0?'#fff':'#faf8ff', cursor:'pointer' }} onClick={()=>loadDrill(row.category,'ALL')}>{row.category}</td>
                      <td style={{ ...S.td, textAlign:'right' }}>
                        <div style={{ fontWeight:700 }}>{fmt_num(row.total.qty)} units</div>
                        <div style={{ fontSize:10, color:'#6b5b7b' }}>{row.total.value>0?fmt_inr(row.total.value):'(cost N/A)'}</div>
                      </td>
                      {allBrands.map(b=>{
                        const cell=row.brands[b]
                        return (
                          <td key={b} style={{ ...S.td, textAlign:'right', cursor:cell?'pointer':'default', background:cell?undefined:'#fafafa' }} onClick={()=>cell&&loadDrill(row.category,b)}>
                            {cell?(<><div style={{ fontWeight:600 }}>{fmt_num(cell.qty)}</div><div style={{ fontSize:10, color:'#6b5b7b' }}>{cell.value>0?fmt_inr(cell.value):'—'}</div></>):<span style={{ color:'#e8d5b7' }}>—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {drillKey&&drillItems.length>0&&(
          <div style={S.section}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #e8d5b7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 className="font-display" style={{ color:'#3b0764', margin:0, fontSize:15 }}>
                  {drillKey.cat==='ALL'?'All Products':drillKey.brand==='ALL'?drillKey.cat:`${drillKey.cat} — ${drillKey.brand}`}
                </h3>
                <p style={{ fontSize:11, color:'#6b5b7b', marginTop:2 }}>{drillItems.length} products in stock · click a name or barcode for full detail</p>
              </div>
              <button onClick={()=>setDrillKey(null)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #e8d5b7', background:'#fff', fontSize:12, cursor:'pointer', color:'#6b5b7b' }}>Close ×</button>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr>{['Product','Category','Brand','Stock','MRP','Cost/Unit','Stock Value'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {drillItems.map((item,i)=>(
                    <tr key={item.item_code} style={{ background:i%2===0?'#fff':'#faf8ff' }}>
                      <td style={S.td}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <HoverImage src={item.image_url} alt={item.product_name} previewSize={280}
                            wrapperStyle={{ width:36, height:36, borderRadius:8, border:'1px solid #e8d5b7', flexShrink:0 }}
                            style={{ width:36, height:36, borderRadius:8 }} />
                          <div>
                            <div onClick={()=>setProductItemCode(item.item_code)} style={{ fontWeight:600, color:'#3b0764', cursor:'pointer', textDecoration:'underline', textDecorationColor:'#c4b5fd' }}>{item.product_name?.slice(0,35)}</div>
                            <div onClick={()=>setProductItemCode(item.item_code)} style={{ fontSize:10, fontFamily:'monospace', color:'#6b5b7b', cursor:'pointer' }}>{item.item_code}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, color:'#6b5b7b' }}>{item.category}</td>
                      <td style={{ ...S.td, color:'#6b5b7b' }}>{item.brand}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:700 }}>{item.qty}</td>
                      <td style={{ ...S.td, textAlign:'right' }}>{item.mrp>0?fmt_inr(item.mrp):'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', color:'#6b5b7b' }}>{item.cost_per_unit>0?fmt_inr(item.cost_per_unit):'—'}</td>
                      <td style={{ ...S.td, textAlign:'right', fontWeight:600 }}>{item.stock_value>0?fmt_inr(item.stock_value):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {productItemCode && <ProductModal itemCode={productItemCode} onClose={()=>setProductItemCode(null)} />}
    </div>
  )
}
