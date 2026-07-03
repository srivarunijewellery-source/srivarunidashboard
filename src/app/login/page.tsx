'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Mail } from 'lucide-react'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError('Incorrect email or password.'); return }
    router.push(searchParams.get('next') || '/overview')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0e8' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, border: '1px solid #e8d5b7', boxShadow: '0 8px 32px rgba(59,7,100,0.12)', padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p className="font-display" style={{ fontSize: 22, color: '#3b0764', margin: 0 }}>Sri Varuni</p>
          <p style={{ color: '#6b5b7b', fontSize: 11, marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' }}>Fashion Jewellery · Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b5b7b' }} />
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid #e8d5b7', fontSize: 14, color: '#1a0a2e', outline: 'none' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b5b7b' }} />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
              style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid #e8d5b7', fontSize: 14, color: '#1a0a2e', outline: 'none' }} />
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ marginTop: 6, padding: '12px', borderRadius: 12, border: 'none', background: '#3b0764', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
