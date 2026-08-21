// src/app/(public)/submit-photo/SubmitPhotoForm.tsx
'use client'

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Sport } from '@/types'

type GameOption = {
  id: string
  game_date: string
  game_time: string | null
  sport_id: string | null
  sport_name: string
  home_team_id: string | null
  away_team_id: string | null
  home_school_id: string | null
  away_school_id: string | null
  home_name: string
  away_name: string
}

interface Props {
  schools: { id: string; school_name: string }[]
  sports: Sport[]
  games: GameOption[]
  initialGameId?: string
}

type DayFilter = 'yesterday' | 'today' | 'tomorrow' | 'all'

function localDateKey(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function timeLabel(value: string | null) {
  if (!value) return 'TBA'
  const [hRaw, mRaw] = value.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (Number.isNaN(h) || Number.isNaN(m)) return value
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function dateLabel(value: string) {
  const d = new Date(`${value}T12:00:00`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function SubmitPhotoForm({ schools, sports, games, initialGameId = '' }: Props) {
  const initialGame = games.find(g => g.id === initialGameId)
  const [form, setForm] = useState({
    submitter_name: '',
    submitter_email: '',
    photographer_credit_name: '',
    school_id: initialGame?.home_school_id || initialGame?.away_school_id || '',
    sport_id: initialGame?.sport_id || '',
    game_id: initialGameId,
    caption: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [permission, setPermission] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dayFilter, setDayFilter] = useState<DayFilter>(initialGame ? 'all' : 'today')
  const [gameSearch, setGameSearch] = useState('')
  const [gameSport, setGameSport] = useState('')
  const [gameSchool, setGameSchool] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedGame = games.find(g => g.id === form.game_id)

  const filteredGames = useMemo(() => {
    const dayMap: Record<Exclude<DayFilter, 'all'>, string> = {
      yesterday: localDateKey(-1),
      today: localDateKey(0),
      tomorrow: localDateKey(1),
    }
    const q = gameSearch.trim().toLowerCase()
    return games.filter(g => {
      if (dayFilter !== 'all' && g.game_date !== dayMap[dayFilter]) return false
      if (gameSport && g.sport_id !== gameSport) return false
      if (gameSchool && g.home_school_id !== gameSchool && g.away_school_id !== gameSchool) return false
      if (q && !`${g.home_name} ${g.away_name} ${g.sport_name}`.toLowerCase().includes(q)) return false
      return true
    }).slice(0, 80)
  }, [games, dayFilter, gameSearch, gameSport, gameSchool])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  const handleGame = (gameId: string) => {
    const game = games.find(g => g.id === gameId)
    setForm(prev => ({
      ...prev,
      game_id: gameId,
      sport_id: game?.sport_id || prev.sport_id,
      school_id: game?.home_school_id || game?.away_school_id || prev.school_id,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !permission || !form.photographer_credit_name) {
      setError('Please select a photo, enter photographer credit, and confirm permission.')
      return
    }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const storagePath = `submissions/${filename}`

    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (uploadErr) {
      setError('Upload failed. Please try again.')
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(storagePath)
    const game = games.find(g => g.id === form.game_id)

    const { error: dbErr } = await supabase.from('photos').insert({
      submitter_name: form.submitter_name || 'Anonymous',
      submitter_email: form.submitter_email || null,
      photographer_credit_name: form.photographer_credit_name,
      school_id: form.school_id || null,
      team_id: game && form.school_id === game.home_school_id
        ? game.home_team_id
        : game && form.school_id === game.away_school_id
          ? game.away_team_id
          : null,
      game_id: form.game_id || null,
      sport_id: form.sport_id || null,
      caption: form.caption || null,
      photo_url: publicUrl,
      permission_confirmed: true,
      approved: false,
      featured: false,
    })

    if (dbErr) {
      await supabase.storage.from('photos').remove([storagePath])
      setError('Submission failed. Please try again.')
    } else {
      setSubmitted(true)
    }

    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-4">📷</div>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Photo Submitted!</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your photo is in the review queue. Once approved, its game, team, school and sport connections can surface it across Section X Scoreboard.
        </p>
      </div>
    )
  }

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <form onSubmit={handleSubmit} className="card p-4 sm:p-6 space-y-5">
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div>
        <label className="label">Photo *</label>
        <div
          className="rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors"
          style={{ borderColor: 'var(--border)' }}
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
          ) : (
            <div>
              <div className="text-3xl mb-2">📸</div>
              <p className="text-sm font-semibold text-white">Choose a photo</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>JPG, PNG, HEIC accepted</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <label className="label mb-0">Which game?</label>
          {form.game_id && <button type="button" onClick={() => handleGame('')} className="text-xs text-slate-400 hover:text-white">Clear</button>}
        </div>

        {selectedGame ? (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-300 font-black">Selected Game</div>
            <div className="mt-1 text-base font-bold text-white">{selectedGame.away_name} at {selectedGame.home_name}</div>
            <div className="text-xs text-slate-400 mt-1">{selectedGame.sport_name} · {dateLabel(selectedGame.game_date)} · {timeLabel(selectedGame.game_time)}</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {(['yesterday', 'today', 'tomorrow', 'all'] as DayFilter[]).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDayFilter(day)}
                  className={`rounded-lg px-2 py-2 text-[11px] font-bold capitalize border ${dayFilter === day ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/[0.03] border-white/10 text-slate-400'}`}
                >
                  {day === 'all' ? 'Search' : day}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-3">
              <input
                className="input w-full"
                value={gameSearch}
                onChange={e => { setGameSearch(e.target.value); if (e.target.value) setDayFilter('all') }}
                placeholder="Search school or matchup..."
              />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={gameSport} onChange={e => { setGameSport(e.target.value); if (e.target.value) setDayFilter('all') }}>
                  <option value="">All sports</option>
                  {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}</option>)}
                </select>
                <select className="input" value={gameSchool} onChange={e => { setGameSchool(e.target.value); if (e.target.value) setDayFilter('all') }}>
                  <option value="">All schools</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden max-h-80 overflow-y-auto">
              {filteredGames.length ? filteredGames.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGame(g.id)}
                  className="w-full text-left p-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.04] active:bg-white/[0.06]"
                >
                  <div className="text-sm font-semibold text-white">{g.away_name} at {g.home_name}</div>
                  <div className="text-xs text-slate-500 mt-1">{g.sport_name} · {dateLabel(g.game_date)} · {timeLabel(g.game_time)}</div>
                </button>
              )) : (
                <div className="p-5 text-center text-sm text-slate-500">
                  No games found. Try Search or clear a filter.
                </div>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Today’s games are shown first. If you opened this from a Game Center, the matchup is preselected automatically.
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Your Name</label>
          <input className="input" value={form.submitter_name} onChange={e => set('submitter_name', e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Your Email</label>
          <input className="input" type="email" value={form.submitter_email} onChange={e => set('submitter_email', e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div>
        <label className="label">Photographer Credit *</label>
        <input className="input" required value={form.photographer_credit_name} onChange={e => set('photographer_credit_name', e.target.value)} placeholder="Name to display as credit" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">School</label>
          <select className="input" value={form.school_id} onChange={e => set('school_id', e.target.value)}>
            <option value="">Select school...</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Sport</label>
          <select className="input" value={form.sport_id} onChange={e => set('sport_id', e.target.value)}>
            <option value="">Select sport...</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Caption</label>
        <textarea className="input" rows={2} value={form.caption} onChange={e => set('caption', e.target.value)} placeholder="Describe the photo..." />
      </div>

      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <input type="checkbox" required checked={permission} onChange={e => setPermission(e.target.checked)} className="mt-0.5 flex-shrink-0" />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          I confirm I took this photo or have permission to submit it, and I allow Section X Scoreboard to display it with credit.
        </span>
      </label>

      <button type="submit" className="btn-primary w-full py-3" disabled={loading || !permission}>
        {loading ? 'Uploading...' : 'Submit Photo for Review'}
      </button>
    </form>
  )
}
