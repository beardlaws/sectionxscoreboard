// src/components/ScoreAlertSignup.tsx
// Reusable score alert signup component
// Use on school pages, homepage, anywhere
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  schoolId?: string
  schoolName?: string
  compact?: boolean // compact mode for sidebars
}

const supabase = createClient()

export default function ScoreAlertSignup({ schoolId, schoolName, compact = false }: Props) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function subscribe() {
    if (!email || !email.includes('@')) { setError('Enter a valid email address.'); return }
    setLoading(true); setError('')
    try {
      const { error: dbError } = await supabase.from('score_alert_subscriptions').insert({
        email: email.toLowerCase().trim(),
        school_id: schoolId || null,
        all_section_x: !schoolId,
        confirmed: true,
      })
      if (dbError && dbError.code !== '23505') { // ignore duplicate
        setError('Something went wrong. Try again.')
        setLoading(false); return
      }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className={`rounded-xl ${compact ? 'p-3' : 'p-4'} text-center`}
        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <p className="text-green-400 font-black text-sm" style={{ fontFamily: 'var(--font-display)' }}>
          ✓ You're signed up!
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {schoolName ? `We'll notify you when ${schoolName} posts scores.` : "We'll notify you when Section X scores are posted."}
        </p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="rounded-xl p-3 border border-white/8"
        style={{ background: 'rgba(10,15,28,0.7)' }}>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2"
          style={{ fontFamily: 'var(--font-display)' }}>
          🔔 Score Alerts
        </p>
        <p className="text-xs text-slate-500 mb-2">
          {schoolName ? `Get notified when ${schoolName} posts a score.` : 'Get notified when scores are posted.'}
        </p>
        <div className="flex gap-1.5">
          <input
            type="email" value={email} placeholder="your@email.com"
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && subscribe()}
            className="input flex-1 text-xs py-1.5"
          />
          <button onClick={subscribe} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg font-black flex-shrink-0"
            style={{ background: 'rgba(37,99,235,0.3)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.4)', fontFamily: 'var(--font-display)' }}>
            {loading ? '...' : 'GO'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-5 border border-white/8"
      style={{ background: 'rgba(10,15,28,0.8)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔔</span>
        <p className="font-black text-white text-base" style={{ fontFamily: 'var(--font-display)' }}>
          Score Alerts
        </p>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        {schoolName
          ? `Get an email when ${schoolName} posts a final score.`
          : 'Get an email when any Section X score is posted tonight.'}
      </p>
      <div className="flex gap-2">
        <input
          type="email" value={email} placeholder="your@email.com"
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && subscribe()}
          className="input flex-1"
        />
        <button onClick={subscribe} disabled={loading}
          className="btn-primary px-4 flex-shrink-0">
          {loading ? '...' : 'Notify Me'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-slate-600 mt-2">No spam. Unsubscribe anytime.</p>
    </div>
  )
}
