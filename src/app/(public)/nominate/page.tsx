// src/app/(public)/nominate/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PublicLayout from '@/components/layout/PublicLayout'

const supabase = createClient()

export default function NominatePage() {
  const [form, setForm] = useState({
    athlete_name: '', school_name: '', sport_name: '', grade: '',
    achievement: '', nominator_name: '', nominator_email: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.athlete_name || !form.school_name || !form.sport_name || !form.achievement) {
      setError('Please fill in all required fields.'); return
    }
    setLoading(true); setError('')
    const { error: dbError } = await supabase.from('athlete_nominations').insert(form)
    if (dbError) { setError('Something went wrong. Try again.'); setLoading(false); return }
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-5xl mb-4">🏅</p>
          <h1 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Nomination Submitted!
          </h1>
          <p className="text-slate-400">Thanks for the nomination. We review all submissions and feature one athlete per week.</p>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🏅</span>
          <div>
            <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Nominate Athlete of the Week
            </h1>
            <p className="text-slate-400 text-sm">Know a Section X athlete who had a great week? Tell us about them.</p>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Athlete Name *</label>
              <input className="input w-full" placeholder="First Last"
                value={form.athlete_name}
                onChange={e => setForm(p => ({ ...p, athlete_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">School *</label>
              <input className="input w-full" placeholder="e.g. Canton Central School"
                value={form.school_name}
                onChange={e => setForm(p => ({ ...p, school_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Sport *</label>
              <input className="input w-full" placeholder="e.g. Baseball, Softball"
                value={form.sport_name}
                onChange={e => setForm(p => ({ ...p, sport_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Grade (optional)</label>
              <input className="input w-full" placeholder="e.g. Senior, Junior"
                value={form.grade}
                onChange={e => setForm(p => ({ ...p, grade: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">What did they do? *</label>
            <textarea className="input w-full h-28 resize-none"
              placeholder="Describe their performance this week. Stats, key moments, anything that makes them stand out..."
              value={form.achievement}
              onChange={e => setForm(p => ({ ...p, achievement: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Your Name (optional)</label>
              <input className="input w-full" placeholder="Coach, parent, fan..."
                value={form.nominator_name}
                onChange={e => setForm(p => ({ ...p, nominator_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Your Email (optional)</label>
              <input className="input w-full" placeholder="In case we have questions"
                value={form.nominator_email}
                onChange={e => setForm(p => ({ ...p, nominator_email: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={submit} disabled={loading} className="btn-primary w-full py-3 text-base">
            {loading ? 'Submitting...' : 'Submit Nomination'}
          </button>
          <p className="text-xs text-slate-600 text-center">
            We feature one athlete per week. All nominations are reviewed before publishing.
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
