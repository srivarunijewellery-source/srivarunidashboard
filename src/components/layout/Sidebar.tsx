'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, TrendingUp, Receipt, Users, BarChart2, ArrowLeftRight, LogOut, Menu, X } from 'lucide-react'
import BranchSelector from './BranchSelector'
import { supabase } from '@/lib/supabase'
import { COLORS } from '@/lib/theme'

const nav = [
  { href: '/overview',       label: 'Overview',       icon: LayoutDashboard },
  { href: '/inventory',      label: 'Inventory',      icon: Package },
  { href: '/stock-transfer', label: 'Stock Transfer', icon: ArrowLeftRight },
  { href: '/sales',          label: 'Sales',           icon: TrendingUp },
  { href: '/expenses',       label: 'Expenses',        icon: Receipt },
  { href: '/customers',      label: 'Customers',       icon: Users },
  { href: '/team',           label: 'Sales Team',      icon: BarChart2 },
]

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the drawer automatically whenever the route changes (tapping a
  // nav link should close it, not leave it hanging open over the new page).
  useEffect(() => { setMobileOpen(false) }, [path])

  // Escape closes it too, same convention every modal in this app already uses.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div
        className={`sidebar-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`app-sidebar${mobileOpen ? ' open' : ''}`}
        style={{ width:220, flexShrink:0, backgroundColor:COLORS.ink, display:'flex', flexDirection:'column', height:'100%' }}
      >
        <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <p className="font-display" style={{ color:'#fff', fontSize:18, lineHeight:1.2, margin:0 }}>Sri Varuni</p>
          <p style={{ color:COLORS.accentLight, fontSize:10, marginTop:2, letterSpacing:2, textTransform:'uppercase' }}>Fashion Jewellery</p>
        </div>
        <BranchSelector />
        <nav style={{ flex:1, padding:'12px 10px', display:'flex', flexDirection:'column', gap:2, overflowY:'auto' }}>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== '/overview' && path.startsWith(href))
            return (
              <Link key={href} href={href} style={{
                display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10,
                fontSize:13, fontWeight:500, textDecoration:'none',
                backgroundColor: active ? COLORS.accent : 'transparent',
                color: active ? '#fff' : COLORS.accentLight, transition:'all 0.15s',
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
          color:COLORS.accentLight, textAlign:'left',
        }}>
          <LogOut size={15} />
          Log out
        </button>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color:COLORS.accentMuted, fontSize:11 }}>Internal Dashboard</p>
          <p style={{ color:COLORS.accent, fontSize:10, marginTop:2 }}>v2.0 · Supabase</p>
        </div>
      </aside>
    </>
  )
}
