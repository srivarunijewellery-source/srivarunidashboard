'use client'
import { useBranch } from '@/lib/branch-context'

export default function BranchSelector() {
  const { branches, selectedBranch, setSelectedBranch } = useBranch()
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <label style={{ color: '#c98d95', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Branch</label>
      <select
        value={selectedBranch ?? 'all'}
        onChange={e => setSelectedBranch(e.target.value === 'all' ? null : e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12 }}
      >
        <option value="all">All Branches (Consolidated)</option>
        {branches.map(b => <option key={b} value={b}>Branch {b}</option>)}
      </select>
    </div>
  )
}
