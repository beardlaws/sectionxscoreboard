// src/app/(public)/submit-score/SubmitScoreForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import type { Sport } from '@/types'

interface Props {
  sports: Sport[]
  schools: { id: string; school_name: string; slug: string }[]
}

export default function SubmitScoreForm({ sports, schools }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({
    submitter_name: '',
    submitter_email: '',
    game_date: today,
    home_team_name: '',
    away_team_name: '',
    home_score: '',
    away_score: '',
    sport_name: '',
    notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.home_team_name || !form.away_team_name || !form.sport_name) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('submissions').insert({
      submitter_name: form.submitter_name,
      submitter_email: form.submitter_email,
      game_date: form.game_date,
      home_team_name: form.home_team_name,
      away_team_name: form.away_team_name,
      home_score: form.home_score ? parseInt(form.home_score) : null,
      away_score: form.away_score ? parseInt(form.away_score) : null,
      sport_name: form.sport_name,
      notes: form.notes,
      status: 'pending',
    })
    if (err) {
      setError('Submission failed. Please try again.')
    } else {
      setSubmitted(true)
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Score Submitted!</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your submission is in the review queue. Thank you for contributing to Section X Scoreboard.
        </p>
      </div>
    )
  }

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Your Name</label>
          <input className="input" value={form.submitter_name} onChange={e => set('submitter_name', e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Your Email</label>
          <input className="input" type="email" value={form.submitter_email} onChange={e => set('submitter_email', e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Sport *</label>
          <select className="input" required value={form.sport_name} onChange={e => set('sport_name', e.target.value)}>
            <option value="">Select sport...</option>
            {sports.map(s => (
              <option key={s.id} value={s.sport_name}>{s.sport_name} ({s.gender})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Game Date *</label>
          <input className="input" type="date" required value={form.game_date} onChange={e => set('game_date', e.target.value)} />
        </div>
      </div>

      {/* Away team */}
      <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div className="section-label">Away Team</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <input
              className="input"
              placeholder="Away team name *"
              required
              value={form.away_team_name}
              onChange={e => set('away_team_name', e.target.value)}
              list="schools-list"
            />
          </div>
          <div>
            <input
              className="input"
              type="number"
              placeholder="Score"
              min="0"
              value={form.away_score}
              onChange={e => set('away_score', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Home team */}
      <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div className="section-label">Home Team</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <input
              className="input"
              placeholder="Home team name *"
              required
              value={form.home_team_name}
              onChange={e => set('home_team_name', e.target.value)}
              list="schools-list"
            />
          </div>
          <div>
            <input
              className="input"
              type="number"
              placeholder="Score"
              min="0"
              value={form.home_score}
              onChange={e => set('home_score', e.target.value)}
            />
          </div>
        </div>
      </div>

      <datalist id="schools-list">
        {schools.map(s => <option key={s.id} value={s.school_name} />)}
      </datalist>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea className="input" placeholder="Any extra context..." rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Score for Review'}
      </button>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Scores are reviewed before publishing. Your contact info will only be used for follow-up questions.
      </p>
    </form>
  )
}
