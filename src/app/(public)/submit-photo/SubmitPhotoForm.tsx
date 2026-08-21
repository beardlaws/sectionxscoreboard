// src/app/(public)/submit-photo/SubmitPhotoForm.tsx
'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Sport } from '@/types'

type GameOption = {
  id: string
  game_date: string
  game_time: string | null
  sport_id: string | null
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
  const fileRef = useRef<HTMLInputElement>(null)

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
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(`submissions/${filename}`, file, { cacheControl: '3600', upsert: false })

    if (uploadErr) {
      setError('Upload failed. Please try again.')
      setLoading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(`submissions/${filename}`)
    const selectedGame = games.find(g => g.id === form.game_id)

    const { error: dbErr } = await supabase.from('photos').insert({
      submitter_name: form.submitter_name || 'Anonymous',
      submitter_email: form.submitter_email || null,
      photographer_credit_name: form.photographer_credit_name,
      school_id: form.school_id || null,
      team_id: selectedGame && form.school_id === selectedGame.home_school_id
        ? selectedGame.home_team_id
        : selectedGame && form.school_id === selectedGame.away_school_id
          ? selectedGame.away_team_id
          : null,
      game_id: form.game_id || null,
      sport_id: form.sport_id || null,
      caption: form.caption || null,
      photo_url: publicUrl,
      permission_confirmed: true,
      approved: false,
      featured: false,
    })

    if (dbErr) setError('Submission failed. Please try again.')
    else setSubmitted(true)

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
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div>
        <label className="label">Photo *</label>
        <div
          className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
          style={{ borderColor: 'var(--border)' }}
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
          ) : (
            <div>
              <div className="text-3xl mb-2">📸</div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Click to upload a photo</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>JPG, PNG, HEIC accepted</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>

      <div>
        <label className="label">Game</label>
        <select className="input" value={form.game_id} onChange={e => handleGame(e.target.value)}>
          <option value="">Not tied to a specific game</option>
          {games.map(g => (
            <option key={g.id} value={g.id}>{g.game_date} · {g.away_name} at {g.home_name}</option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Choosing a game connects the photo to the matchup and automatically selects its sport.
        </p>
      </div>

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

      <div>
        <label className="label">Photographer Credit *</label>
        <input className="input" required value={form.photographer_credit_name} onChange={e => set('photographer_credit_name', e.target.value)} placeholder="Name to display as credit" />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
