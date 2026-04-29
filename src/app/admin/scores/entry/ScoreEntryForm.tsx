// src/app/admin/scores/entry/ScoreEntryForm.tsx
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import type { Sport, Season } from '@/types'

interface Team {
  id: string
  team_name: string
  school: { school_name: string; alias: string } | null
  sport_id: string
}

interface Props {
  sports: Sport[]
  teams: Team[]
  seasons: Season[]
}

export default function ScoreEntryForm({ sports, teams, seasons }: Props) {
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')
  const activeSeason = seasons.find(s => s.is_active) || seasons[0]

  const [form, setForm] = useState({
    season_id: activeSeason?.id || '',
    sport_id: '',
    game_date: today,
    game_time: '',
    home_team_id: '',
    away_team_id: '',
    home_score: '',
    away_score: '',
    status: 'Final' as string,
    verification_status: 'Reported' as string,
    location: '',
    notes: '',
    featured: false,
    game_of_the_night: false,
    neutral_site: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredTeams = useMemo(() =>
    form.sport_id ? teams.filter(t => t.sport_id === form.sport_id) : teams,
    [teams, form.sport_id]
  )

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.sport_id || !form.game_date) {
      setError('Sport and date are required.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const payload = {
      season_id: form.season_id || null,
      sport_id: form.sport_id,
      game_date: form.game_date,
      game_time: form.game_time || null,
      home_team_id: form.home_team_id || null,
      away_team_id: form.away_team_id || null,
      home_score: form.home_score !== '' ? parseInt(form.home_score) : null,
      away_score: form.away_score !== '' ? parseInt(form.away_score) : null,
      status: form.status,
      verification_status: form.verification_status,
      location: form.location || null,
      notes: form.notes || null,
      featured: form.featured,
      game_of_the_night: form.game_of_the_night,
      neutral_site: form.neutral_site,
      source: 'manual',
    }

    const { error: err } = await supabase.from('games').insert(payload)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Game saved!')
      setTimeout(() => {
        router.push('/admin')
      }, 1500)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      {error && <div className="text-sm p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{error}</div>}
      {success && <div className="text-sm p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>{success}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Sport *</label>
          <select className="input" required value={form.sport_id} onChange={e => set('sport_id', e.target.value)}>
            <option value="">Select sport...</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name} ({s.gender})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Season</label>
          <select className="input" value={form.season_id} onChange={e => set('season_id', e.target.value)}>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Game Date *</label>
          <input className="input" type="date" required value={form.game_date} onChange={e => set('game_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Game Time</label>
          <input className="input" type="time" value={form.game_time} onChange={e => set('game_time', e.target.value)} />
        </div>
      </div>

      {/* Away team */}
      <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div className="section-label">Away Team</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <select className="input" value={form.away_team_id} onChange={e => set('away_team_id', e.target.value)}>
              <option value="">Select team...</option>
              {filteredTeams.map(t => (
                <option key={t.id} value={t.id}>{t.school?.school_name || t.team_name}</option>
              ))}
            </select>
          </div>
          <input className="input" type="number" min="0" placeholder="Score" value={form.away_score} onChange={e => set('away_score', e.target.value)} />
        </div>
      </div>

      {/* Home team */}
      <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div className="section-label">Home Team</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <select className="input" value={form.home_team_id} onChange={e => set('home_team_id', e.target.value)}>
              <option value="">Select team...</option>
              {filteredTeams.map(t => (
                <option key={t.id} value={t.id}>{t.school?.school_name || t.team_name}</option>
              ))}
            </select>
          </div>
          <input className="input" type="number" min="0" placeholder="Score" value={form.home_score} onChange={e => set('home_score', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option>Scheduled</option>
            <option>Final</option>
            <option>Live</option>
            <option>Postponed</option>
            <option>Canceled</option>
          </select>
        </div>
        <div>
          <label className="label">Verification</label>
          <select className="input" value={form.verification_status} onChange={e => set('verification_status', e.target.value)}>
            <option>Reported</option>
            <option>Verified</option>
            <option>Official</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Location</label>
        <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Field/gym name..." />
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-4">
        {[
          { key: 'game_of_the_night', label: '⭐ Game of the Night' },
          { key: 'featured', label: '📌 Featured' },
          { key: 'neutral_site', label: '🏟️ Neutral Site' },
        ].map(flag => (
          <label key={flag.key} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={form[flag.key as keyof typeof form] as boolean}
              onChange={e => set(flag.key, e.target.checked)}
            />
            {flag.label}
          </label>
        ))}
      </div>

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
        {loading ? 'Saving...' : 'Save Game'}
      </button>
    </form>
  )
}
