'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, TrendingUp, Receipt, Users, BarChart2, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/sales', label: 'Sales', icon: TrendingUp },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/team', label: 'Sales Team', icon: BarChart2 },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 bg-sv-purple flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-purple-800">
        <p className="font-display text-white text-lg leading-tight">Sri Varuni</p>
        <p className="text-purple-300 text-xs mt-0.5 tracking-widest uppercase">Fashion Jewellery</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/' && path.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-sv-purple-light text-white shadow-sm'
                  : 'text-purple-300 hover:text-white hover:bg-purple-800'
              )}
            >
              <Icon size={16} className={active ? 'text-sv-purple-pale' : ''} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-purple-800">
        <p className="text-purple-400 text-xs">Internal Dashboard</p>
        <p className="text-purple-500 text-xs mt-0.5">v2.0 · Supabase</p>
      </div>
    </aside>
  )
}
