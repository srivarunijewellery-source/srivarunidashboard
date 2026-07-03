'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, TrendingUp, Receipt, Users, BarChart2, LogOut } from 'lucide-react'
import BranchSelector from './BranchSelector'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/overview',   label: 'Overview',    icon: LayoutDashboard },
  { href: '/inventory',  label: 'Inventory',   icon: Package },
  { href: '/sales',      label: 'Sales',       icon: TrendingUp },
  { href: '/expenses',   label: 'Expenses',    icon: Receipt },
  { href: '/customers',  label: 'Customers',   icon: Users },
  { href: '/team',       label: 'Sales Team',  icon: BarChart2 },
]

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{ width:220, flexShrink:0, backgroundColor:'#3b0764', display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
        <p className="font-display" style={{ color:'#fff', fontSize:18, lineHeight:1.2, margin:0 }}>Sri Varuni</p>
        <p style={{ color:'#c4b5fd', fontSize:10, marginTop:2, letterSpacing:2, textTransform:'uppercase' }}>Fashion Jewellery</p>
      </div>
      <BranchSelector />
      <nav style={{ flex:1, padding:'12px 10px', display:'flex', flexDirection:'column', gap:2 }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/overview' && path.startsWith(href))
          return (
            <Link key={href} href={href} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10,
              fontSize:13, fontWeight:500, textDecoration:'none',
              backgroundColor: active ? '#7c3aed' : 'transparent',
              color: active ? '#fff' : '#c4b5fd', transition:'all 0.15s',
            }}>
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>
      <button onClick={handleLogout} style={{
        display:'flex', alignItems:'center', gap:10, margin:'0 10px 8px', padding:'10px 12px', borderRadius:10,
        fontSize:13, fontWeight:500, background:'transparent', border:'none', cursor:'pointer',
        color:'#c4b5fd', textAlign:'left',
      }}>
        <LogOut size={15} />
        Log out
      </button>
      <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ color:'#a78bfa', fontSize:11 }}>Internal Dashboard</p>
        <p style={{ color:'#7c3aed', fontSize:10, marginTop:2 }}>v2.0 · Supabase</p>
      </div>
    </aside>
  )
}
