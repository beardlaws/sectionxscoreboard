'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'

const supabase = createClient()

const CLASSES = ['A', 'B', 'C', 'D']

export default function PlayoffsAdmin() {
  const [sports, setSports] = useState<any[]>([])
  const [seasons, setSeasons] = useState<any[]>([])
  const [tournaments, setTournaments] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ sport_id: '', season_id: '', class: '', name: '' })
  const [openId, setOpenId] = useState<string|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sp }, { data: se }, { data: tr }, { data: gm }] = await Promise.all([
      supabase.from('sports').select('id,sport_name,gender').order('sport_name'),
      supabase.from('seasons').select('id,name,is_active').order('year', { ascending: false }),
      supabase.from('playoff_tournaments').select('*').order('created_at'),
      supabase.from('playoff_games').select('*').order('round').order('position'),
    ])
    setSports(sp || [])
    setSeasons(se || [])
    setTournaments(tr || [])
    setGames(gm || [])
    const active = se?.find((s: any) => s.is_active)
    if (active && !form.season_id) setForm(p => ({ ...p, season_id: active.id }))
    setLoading(false)
  }

  async function createBracket() {
    if (!form.sport_id || !form.season_id || !form.class) {
      setMsg('Please select sport, season, and class.')
      return
    }
    setCreating(true)
    setMsg('')
    const sport = sports.find(s => s.id === form.sport_id)
    const name = form.name || `Class ${form.class} ${sport?.gender} ${sport?.sport_name} Playoffs`
    const { data, error } = await supabase.from('playoff_tournaments')
      .insert({ sport_id: form.sport_id, season_id: form.season_id, class: form.class, name, status: 'upcoming' })
      .select().single()
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setMsg('Bracket created!')
      setOpenId(data.id)
      load()
    }
    setCreating(false)
  }

  async function addGame(tournamentId: string, round: number) {
    const existing = games.filter(g => g.tournament_id === tournamentId && g.round === round)
    const position = existing.length + 1
    await supabase.from('playoff_games').insert({
      tournament_id: tournamentId, round, position, status: 'upcoming'
    })
    load()
  }

  async function saveGame(game: any) {
    const { id, ...updates } = game
    const { error } = await supabase.from('playoff_games').update(updates).eq('id', id)
    if (error) alert('Save error: ' + error.message)
    else load()
  }

  async function deleteTournament(id: string) {
    if (!confirm('Delete this bracket and all its games?')) return
    await supabase.from('playoff_games').delete().eq('tournament_id', id)
    await supabase.from('playoff_tournaments').delete().eq('id', id)
    load()
  }

  async function deleteGame(id: string) {
    await supabase.from('playoff_games').delete().eq('id', id)
    load()
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('playoff_tournaments').update({ status }).eq('id', id)
    load()
  }

  const roundName = (r: number, max: number) => {
    if (max <= 2) return r === 1 ? 'Semifinals' : 'Final'
    if (max <= 3) return r === 1 ? 'Quarterfinals' : r === 2 ? 'Semifinals' : 'Final'
    return r === 1 ? 'First Round' : r === 2 ? 'Quarterfinals' : r === 3 ? 'Semifinals' : 'Final'
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>🏆 Playoff Brackets</h1>
        <p className="text-slate-400 text-sm mb-5">Create a bracket per class per sport. Add matchups and update scores as games are played.</p>

        {/* Create form */}
        <div className="card p-4 mb-6">
          <p className="text-sm font-bold text-white mb-3">Create New Bracket</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Sport *</label>
              <select className="input w-full" value={form.sport_id} onChange={e => setForm(p => ({ ...p, sport_id: e.target.value }))}>
                <option value="">Select...</option>
                {sports.map(s => <option key={s.id} value={s.id}>{s.gender} {s.sport_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Season *</label>
              <select className="input w-full" value={form.season_id} onChange={e => setForm(p => ({ ...p, season_id: e.target.value }))}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' ✓' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class *</label>
              <select className="input w-full" value={form.class} onChange={e => setForm(p => ({ ...p, class: e.target.value }))}>
                <option value="">Select...</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Name (optional)</label>
              <input className="input w-full" placeholder="Auto-generated" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          {msg && <p className={`text-sm mb-2 ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
          <button onClick={createBracket} disabled={creating} className="btn-primary">
            {creating ? 'Creating...' : '+ Create Bracket'}
          </button>
        </div>

        {/* Brackets list */}
        {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
          <div className="space-y-4">
            {tournaments.length === 0 && (
              <div className="card p-8 text-center text-slate-500">No brackets yet.</div>
            )}
            {tournaments.map(t => {
              const tGames = games.filter(g => g.tournament_id === t.id)
              const rounds = [...new Set(tGames.map(g => g.round))].sort((a,b) => a-b)
              const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0
              const isOpen = openId === t.id
              const sport = sports.find(s => s.id === t.sport_id)

              return (
                <div key={t.id} className="card overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setOpenId(isOpen ? null : t.id)}>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">
                        {sport?.gender} {sport?.sport_name} · Class {t.class}
                        {' · '}{seasons.find(s => s.id === t.season_id)?.name}
                      </p>
                      <p className="text-white font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{tGames.length} games</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={t.status} onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); setStatus(t.id, e.target.value) }}
                        className="input text-xs py-1 px-2">
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="complete">Complete</option>
                      </select>
                      <button onClick={e => { e.stopPropagation(); deleteTournament(t.id) }}
                        className="text-red-400 hover:text-red-300 text-xs px-2">✕</button>
                      <span className="text-slate-500">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/8 p-4">
                      {/* Add round buttons */}
                      <div className="flex gap-2 flex-wrap mb-4">
                        <p className="text-xs text-slate-500 w-full">Add matchup to round:</p>
                        {[1,2,3,4].map(r => (
                          <button key={r} onClick={() => addGame(t.id, r)}
                            className="btn-ghost text-xs py-1 px-3">
                            + {roundName(r, Math.max(maxRound, r))}
                          </button>
                        ))}
                      </div>

                      {/* Games by round */}
                      {rounds.map(round => {
                        const roundGames = tGames.filter(g => g.round === round).sort((a,b) => a.position - b.position)
                        return (
                          <div key={round} className="mb-5">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                              style={{ fontFamily: 'var(--font-display)' }}>
                              {roundName(round, maxRound)}
                            </p>
                            <div className="space-y-3">
                              {roundGames.map(game => (
                                <GameRow key={game.id} game={game}
                                  onSave={saveGame} onDelete={() => deleteGame(game.id)} />
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {tGames.length === 0 && (
                        <p className="text-sm text-slate-600 text-center py-4">
                          Click a round button above to add matchups.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function GameRow({ game, onSave, onDelete }: { game: any, onSave: (g: any) => void, onDelete: () => void }) {
  const [f, setF] = useState({
    away_name: game.away_name || '',
    home_name: game.home_name || '',
    seed_away: game.seed_away || '',
    seed_home: game.seed_home || '',
    away_score: game.away_score ?? '',
    home_score: game.home_score ?? '',
    status: game.status || 'upcoming',
    game_date: game.game_date || '',
    game_time: game.game_time?.slice(0,5) || '',
    location: game.location || '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave({
      id: game.id,
      away_name: f.away_name || null,
      home_name: f.home_name || null,
      seed_away: f.seed_away !== '' ? parseInt(f.seed_away) : null,
      seed_home: f.seed_home !== '' ? parseInt(f.seed_home) : null,
      away_score: f.away_score !== '' ? parseInt(f.away_score) : null,
      home_score: f.home_score !== '' ? parseInt(f.home_score) : null,
      status: f.status,
      game_date: f.game_date || null,
      game_time: f.game_time ? f.game_time + ':00' : null,
      location: f.location || null,
    })
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-white/8 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Away */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Away Team</p>
          <div className="flex gap-2">
            <input type="number" placeholder="Seed" value={f.seed_away}
              onChange={e => setF(p => ({ ...p, seed_away: e.target.value }))}
              className="input w-16 text-center" />
            <input placeholder="Team name" value={f.away_name}
              onChange={e => setF(p => ({ ...p, away_name: e.target.value }))}
              className="input flex-1" />
            <input type="number" placeholder="Score" value={f.away_score}
              onChange={e => setF(p => ({ ...p, away_score: e.target.value }))}
              className="input w-16 text-center font-mono font-bold" />
          </div>
        </div>
        {/* Home */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Home Team</p>
          <div className="flex gap-2">
            <input type="number" placeholder="Seed" value={f.seed_home}
              onChange={e => setF(p => ({ ...p, seed_home: e.target.value }))}
              className="input w-16 text-center" />
            <input placeholder="Team name" value={f.home_name}
              onChange={e => setF(p => ({ ...p, home_name: e.target.value }))}
              className="input flex-1" />
            <input type="number" placeholder="Score" value={f.home_score}
              onChange={e => setF(p => ({ ...p, home_score: e.target.value }))}
              className="input w-16 text-center font-mono font-bold" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} className="input text-sm py-1.5" style={{ width: 'auto' }}>
          <option value="upcoming">Upcoming</option>
          <option value="scheduled">Scheduled</option>
          <option value="final">Final</option>
        </select>
        <input type="date" value={f.game_date} onChange={e => setF(p => ({ ...p, game_date: e.target.value }))}
          className="input text-sm py-1.5" style={{ colorScheme: 'dark', width: 'auto' }} />
        <input type="time" value={f.game_time} onChange={e => setF(p => ({ ...p, game_time: e.target.value }))}
          className="input text-sm py-1.5" style={{ colorScheme: 'dark', width: 'auto' }} />
        <input placeholder="Location" value={f.location} onChange={e => setF(p => ({ ...p, location: e.target.value }))}
          className="input text-sm py-1.5 flex-1" />
        <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onDelete} className="btn-danger text-sm py-1.5">Del</button>
      </div>
    </div>
  )
}
