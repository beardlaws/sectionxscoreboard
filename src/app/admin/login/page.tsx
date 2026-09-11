'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function safeAdminDestination(value: string | null) {
  if (!value) return '/admin'
  // Keep post-login navigation strictly inside the first-party admin surface.
  // This avoids open redirects while still returning operators to the page
  // middleware originally protected, such as /admin/live-audio.
  return value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin'
}

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.replace(safeAdminDestination(searchParams.get('next')))
        router.refresh()
      } else if (res.status === 503) {
        setError('Admin authentication is not configured on this deployment.')
      } else {
        setError('Wrong password.')
      }
    } catch {
      setError('Unable to reach the admin login service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="card p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold font-display text-white mb-1">Section X Admin</h1>
        <p className="text-slate-400 text-sm mb-6">Enter the admin password to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="input w-full"
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
